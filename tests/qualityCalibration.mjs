/**
 * qualityCalibration.mjs
 *
 * Blockbuster Quality Calibration — CLI generation harness.
 *
 * Builds UBS prompts using the real prompt builders, generates prose through Ollama,
 * runs safety gates, scores quality via programmatic analysis + LLM critic,
 * and writes all 8 calibration reports.
 *
 * Usage: node --loader ./tests/loader.mjs tests/qualityCalibration.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// ── Prompt builders (resolve via loader @/lib → src/lib) ──
import {
  buildProjectContextHeader,
  createInitialProjectSettings,
  buildExpandFoundationPrompt,
  computeTotalWordTarget,
  applyGenreDefaults,
  buildSpiceBeatInstructions,
  CHAPTER_LENGTH_PRESETS,
} from '../src/lib/autonovel.js';
import { buildSetupConstraints } from '../src/lib/setupConstraints.js';
import { buildPovTenseBlock } from '../src/lib/povTense.js';
import { buildPacingBlock } from '../src/lib/pacingModulation.js';
import { runManuscriptSafetyGate } from '../src/lib/manuscriptSafetyGate.js';
import { runPreExportSafetyGate } from '../src/lib/exportSafetyGate.js';
import { POLISH_PROFILES } from '../src/lib/polishPipelineConfig.js';

// ── Ollama direct call (no base44/localDB dependency) ──
const OLLAMA = 'http://127.0.0.1:11434';

async function callOllama(model, prompt, systemPrompt = '', temp = 0.72, maxTokens = 6000) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, options: { temperature: temp, num_predict: maxTokens } }),
    signal: AbortSignal.timeout(1200000),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text().catch(() => 'unknown')}`);
  const data = await res.json();
  let text = data?.message?.content || '';
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/think>/gi, '').replace(/\\boxed\{[^}]*\}/g, '').trim();
  return text;
}

// ── Output directory ──
const OUT = resolve('smoke-test-output/blockbuster-quality-calibration');
mkdirSync(OUT, { recursive: true });

// ═══════════════════════════════════════════════════════════════
// PROJECT FACTORY
// ═══════════════════════════════════════════════════════════════

function makeProject(overrides) {
  const base = createInitialProjectSettings(overrides.book_type || 'fiction');
  const merged = { ...base, ...overrides };
  if (overrides.genre) {
    try { Object.assign(merged, applyGenreDefaults(merged, overrides.genre)); } catch {}
  }
  // Re-apply overrides to prevent genre defaults from overwriting
  Object.assign(merged, overrides);
  merged.total_word_target = computeTotalWordTarget(merged.chapter_target, merged.chapter_length_target);
  return merged;
}

const PROJECTS = {
  // ── Fiction ──
  A: makeProject({
    label: 'High-Concept Thriller',
    book_type: 'fiction',
    content_lane: 'fiction',
    genre: 'Thriller',
    subgenre: 'Conspiracy Thriller',
    seed_concept: 'A private disaster-response consultant discovers every emergency alert in America has been pre-written three days before the disaster happens.',
    title: 'The Three-Day Warning',
    author_voice: 'Clean Commercial Thriller',
    beat_style: 'Tension-Driven',
    story_arc: 'thriller_escalation',
    pov_mode: 'third-close',
    tense: 'past',
    language_intensity: 2,
    spice_level: 0,
    chapter_target: 18,
    chapter_length_target: 3500,
    reading_level: 'adult',
    target_audience: 'adult thriller readers',
  }),
  B: makeProject({
    label: 'Gothic Horror',
    book_type: 'fiction',
    content_lane: 'fiction',
    genre: 'Horror',
    subgenre: 'Gothic Horror',
    seed_concept: 'A woman inherits a lakeside inn where every guest ledger contains one name written in handwriting that matches her dead mother\'s.',
    title: 'The Ledger',
    author_voice: 'Literary Atmospheric',
    beat_style: 'Literary Atmospheric',
    story_arc: 'horror_descent',
    pov_mode: 'first',
    tense: 'past',
    language_intensity: 1,
    spice_level: 0,
    chapter_target: 20,
    chapter_length_target: 3500,
    reading_level: 'adult',
    target_audience: 'horror and gothic fiction readers',
  }),
  C: makeProject({
    label: 'Romantic Suspense',
    book_type: 'fiction',
    content_lane: 'fiction',
    genre: 'Romance',
    subgenre: 'Romantic Suspense',
    seed_concept: 'Two rival forensic accountants are forced to share a safehouse after discovering the same billionaire client has been laundering money through missing-person charities.',
    title: 'Double Entry',
    author_voice: 'Clean Commercial Romance',
    beat_style: 'Slow Burn Romance',
    story_arc: 'romance_arc',
    pov_mode: 'third-close',
    tense: 'past',
    language_intensity: 2,
    spice_level: 2,
    chapter_target: 22,
    chapter_length_target: 3500,
    reading_level: 'adult',
    target_audience: 'adult romance and suspense readers',
  }),
  // ── Nonfiction ──
  D: makeProject({
    label: 'Investigative Nonfiction',
    book_type: 'nonfiction',
    content_lane: 'nonfiction',
    genre: 'Investigative',
    subgenre: 'Technology & Society',
    seed_concept: 'How algorithmic decision systems quietly shape housing, employment, insurance, and criminal justice outcomes before people ever reach a human decision-maker.',
    title: 'Before the Human',
    author_voice: 'Custom / None',
    nf_structure_mode: 'investigative',
    pov_mode: 'nf-direct',
    tense: 'present',
    language_intensity: 1,
    spice_level: 0,
    chapter_target: 12,
    chapter_length_target: 5000,
    reading_level: 'adult',
    target_audience: 'general educated readers interested in technology and justice',
  }),
  E: makeProject({
    label: 'Professional Guide',
    book_type: 'nonfiction',
    content_lane: 'nonfiction',
    genre: 'Self-Help',
    subgenre: 'Caregiver Wellness',
    seed_concept: 'A field guide for exhausted caregivers and support professionals on building sustainable, person-centered care without burning out.',
    title: 'The Caregiver\'s Compass',
    author_voice: 'Custom / None',
    nf_structure_mode: 'prescriptive',
    pov_mode: 'nf-direct',
    tense: 'present',
    language_intensity: 0,
    spice_level: 0,
    chapter_target: 14,
    chapter_length_target: 4000,
    reading_level: 'adult',
    target_audience: 'caregivers, social workers, and support professionals',
  }),
};

// ── Style bakeoff combinations (all share one premise) ──
const BAKEOFF_PREMISE = 'A missing child\'s voice begins broadcasting from every smart speaker in a city, but the child has been dead for twelve years.';
const BAKEOFF_COMBOS = [
  { label: 'Thriller + Clean Commercial + Fast Escalation', genre: 'Thriller', subgenre: 'Techno-Thriller', author_voice: 'Clean Commercial Thriller', beat_style: 'Tension-Driven', story_arc: 'thriller_escalation', pov_mode: 'third-close', tense: 'past' },
  { label: 'Horror + Lyrical Gothic + Slow-Burn Dread', genre: 'Horror', subgenre: 'Gothic Horror', author_voice: 'Literary Atmospheric', beat_style: 'Literary Atmospheric', story_arc: 'horror_descent', pov_mode: 'first', tense: 'past' },
  { label: 'Mystery + Investigative Discovery + Moderate', genre: 'Mystery', subgenre: 'Procedural', author_voice: 'Custom / None', beat_style: 'Mystery Unravel', story_arc: 'mystery_reveal', pov_mode: 'third-close', tense: 'past' },
  { label: 'Literary + Minimalist + Quiet Dread', genre: 'Literary Fiction', subgenre: 'Psychological', author_voice: 'Literary Atmospheric', beat_style: 'Character Study', story_arc: 'literary_character', pov_mode: 'first', tense: 'present' },
  { label: 'Sci-Fi + Procedural Realistic + System Anomaly', genre: 'Science Fiction', subgenre: 'Near-Future', author_voice: 'Custom / None', beat_style: 'Tension-Driven', story_arc: 'three_act', pov_mode: 'third-close', tense: 'past' },
  { label: 'Romantic Suspense + Cinematic + Emotional', genre: 'Romance', subgenre: 'Romantic Suspense', author_voice: 'Clean Commercial Romance', beat_style: 'Slow Burn Romance', story_arc: 'romance_arc', pov_mode: 'third-close', tense: 'past' },
];

// ═══════════════════════════════════════════════════════════════
// PROMPT CONSTRUCTION (mirrors sceneWriter.js pipeline)
// ═══════════════════════════════════════════════════════════════

function buildChapterOnePrompt(project) {
  const header = buildProjectContextHeader(project);
  const constraints = buildSetupConstraints(project);
  const povBlock = buildPovTenseBlock(project);
  const pacingBlock = buildPacingBlock(project, { chapter_number: 1 });
  const spiceBlock = buildSpiceBeatInstructions(project) || '';

  const isNF = project.book_type === 'nonfiction';
  const wordTarget = project.chapter_length_target || 3500;

  const sceneBeat = isNF
    ? `Write Chapter 1 of this nonfiction book. Open with a vivid scene, case study, or anecdote that immediately illustrates the book's central thesis. Establish authority and urgency. Structure: Hook → Context → Stakes → Forward promise.`
    : `Write Chapter 1 of this novel. Open with a scene that establishes the protagonist, the world, and the central tension. The first sentence must hook the reader. End the chapter with a page-turn moment that makes stopping impossible.`;

  const prompt = `${header}

${constraints}

${povBlock}

${pacingBlock}
${spiceBlock ? '\n' + spiceBlock : ''}

── CHAPTER 1 DRAFTING INSTRUCTIONS ──

${sceneBeat}

PREMISE: ${project.seed_concept}

TARGET: ~${wordTarget} words for this chapter.

QUALITY MANDATE:
- First sentence must be UNFORGETTABLE. No weather, no waking up, no generic openers.
- Every paragraph must do work: advance plot, reveal character, build tension, or establish world.
- Dialogue must sound like real people talking, not exposition delivery.
- Use concrete, specific details. No "the room" — name it. No "a city" — ground it.
- End with a revelation, reversal, or unresolved tension that DEMANDS the next chapter.
- Zero AI slop: no "delve", "tapestry", "testament to", "I cannot and will not", "landscape of", "dance of".
- No process commentary. No "As an AI." Just write the chapter.

CRITICAL: DO NOT REFERENCE OTHER PROJECTS OR ORGANIZATIONS.
The following terms are FORBIDDEN in this manuscript: "Unity Supported Living Services", "Unity Supported Living", "Unity Media Solutions", "Unity Media", "care documentation", "compliance documentation", "AI content pipeline", "premium digital resource hub".
Do not mention real companies, business plans, funding streams, or app launches unless they are explicitly part of this story's world.
Write only within the world and characters of THIS project.

Write Chapter 1 now. Output ONLY the chapter prose. No meta-commentary, no scene headings, no word counts.`;

  return prompt;
}

// ═══════════════════════════════════════════════════════════════
// QUALITY SCORING — PROGRAMMATIC
// ═══════════════════════════════════════════════════════════════

const AI_SLOP_PHRASES = [
  'delve', 'tapestry', 'testament to', 'I cannot and will not',
  'landscape of', 'dance of', 'symphony of', 'a sense of', 'palpable',
  'sending shivers', 'As an AI', 'I\'d be happy to', 'echoed through',
  'pierced the', 'shattered the silence', 'hung in the air', 'cut through',
  'world of', 'realm of', 'journey of', 'in the world of',
  'nestled', 'labyrinthine', 'kaleidoscope', 'crucible of',
  'ever-evolving', 'myriad', 'complexities', 'intricacies',
  'relentless pursuit', 'unbeknownst', 'couldn\'t help but',
  'a mixture of', 'a wave of', 'a surge of',
];

const FILTER_WORDS = ['seemed', 'appeared', 'felt like', 'sort of', 'kind of', 'basically', 'actually', 'really', 'very', 'just'];
const PASSIVE_MARKERS = [' was ', ' were ', ' been ', ' being ', ' is being ', ' was being '];
const SENSORY_WORDS = ['see', 'saw', 'heard', 'hear', 'smell', 'smelled', 'taste', 'tasted', 'touch', 'touched', 'felt', 'cold', 'warm', 'hot', 'sharp', 'rough', 'smooth', 'bright', 'dark', 'loud', 'quiet', 'bitter', 'sweet', 'metallic', 'damp', 'dry'];

function programmaticScore(text, project) {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 10);
  const lowerText = text.toLowerCase();

  // 1. Hook strength
  const firstSentence = sentences[0] || '';
  const firstSentenceWords = firstSentence.trim().split(/\s+/).length;
  const hasNameInFirst = /[A-Z][a-z]{2,}/.test(firstSentence);
  const hasActionVerb = /\b(discovered|ran|pulled|slammed|whispered|stared|grabbed|opened|closed|stepped|turned|heard|saw|felt)\b/i.test(firstSentence);
  const noGenericOpener = !(/^(The (morning|evening|sun|rain|sky|air)|It was a|Once upon|There (was|were)|In the)\b/i.test(firstSentence.trim()));
  let hookScore = 60;
  if (firstSentenceWords >= 10 && firstSentenceWords <= 45) hookScore += 8;
  if (hasNameInFirst) hookScore += 8;
  if (hasActionVerb) hookScore += 8;
  if (noGenericOpener) hookScore += 8;
  if (firstSentence.includes('?') || /but |yet |when |before /.test(firstSentence.toLowerCase())) hookScore += 8;
  hookScore = Math.min(100, hookScore);

  // 2. Scene immediacy
  const firstPara = paragraphs[0] || '';
  const sensoryCount = SENSORY_WORDS.filter(w => firstPara.toLowerCase().includes(w)).length;
  const firstParaHasDialogue = firstPara.includes('"');
  let immediacyScore = 55;
  immediacyScore += Math.min(20, sensoryCount * 5);
  if (firstParaHasDialogue) immediacyScore += 8;
  if (!firstPara.toLowerCase().includes('there was') && !firstPara.toLowerCase().includes('it was a')) immediacyScore += 8;
  if (/[A-Z][a-z]+/.test(firstPara)) immediacyScore += 5;
  immediacyScore = Math.min(100, immediacyScore);

  // 3. Character desire/conflict
  const actionVerbs = (text.match(/\b(need|want|must|had to|couldn't|wouldn't|refused|demanded|fought|struggled|pushed|pulled|forced|tried|failed|searched)\b/gi) || []).length;
  const hasNamedChar = (text.match(/[A-Z][a-z]{2,}/g) || []).length;
  let desireScore = 55 + Math.min(20, actionVerbs * 2) + Math.min(10, hasNamedChar > 3 ? 10 : hasNamedChar * 3);
  desireScore = Math.min(100, desireScore);

  // 4. Voice distinctiveness
  const sentLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgSentLen = sentLengths.reduce((a, b) => a + b, 0) / Math.max(1, sentLengths.length);
  const sentStdDev = Math.sqrt(sentLengths.reduce((sum, l) => sum + (l - avgSentLen) ** 2, 0) / Math.max(1, sentLengths.length));
  const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
  const uniqueRatio = uniqueWords / Math.max(1, wordCount);
  let voiceScore = 50;
  voiceScore += Math.min(15, sentStdDev * 2); // higher variation = more voice
  voiceScore += Math.min(15, uniqueRatio > 0.45 ? 15 : uniqueRatio * 30);
  const slopCount = AI_SLOP_PHRASES.filter(p => lowerText.includes(p.toLowerCase())).length;
  voiceScore -= slopCount * 4;
  voiceScore = Math.max(20, Math.min(100, voiceScore));

  // 5. Sentence-level polish
  const adverbs = (text.match(/\b\w+ly\b/g) || []).filter(w => !['only', 'early', 'family', 'really', 'likely', 'lonely', 'finally', 'slowly', 'quickly', 'suddenly'].includes(w.toLowerCase()));
  const adverbDensity = adverbs.length / Math.max(1, wordCount);
  const passiveCount = PASSIVE_MARKERS.filter(p => lowerText.includes(p)).length;
  const filterCount = FILTER_WORDS.filter(w => lowerText.includes(w)).length;
  let polishScore = 80;
  polishScore -= Math.min(20, adverbDensity * 500);
  polishScore -= Math.min(15, passiveCount * 2);
  polishScore -= Math.min(15, filterCount * 2);
  polishScore -= slopCount * 5;
  polishScore = Math.max(20, Math.min(100, polishScore));

  // 6. Genre fit (genre-specific vocab)
  const genre = (project?.genre || '').toLowerCase();
  const genreVocab = {
    thriller: ['stakes', 'deadline', 'threat', 'target', 'protocol', 'asset', 'compromised', 'intel', 'operative', 'classified', 'secure', 'breach'],
    horror: ['dread', 'shadow', 'wrong', 'darkness', 'silence', 'cold', 'twisted', 'rot', 'decay', 'whisper', 'crawl', 'bone'],
    romance: ['chemistry', 'tension', 'desire', 'warmth', 'touch', 'eyes', 'breath', 'heart', 'close', 'lips', 'pulse', 'skin'],
    mystery: ['clue', 'evidence', 'suspect', 'witness', 'motive', 'alibi', 'detective', 'case', 'investigation', 'scene'],
    'literary fiction': ['silence', 'memory', 'light', 'distance', 'ordinary', 'gesture', 'weight', 'absence', 'language', 'meaning'],
    'science fiction': ['system', 'data', 'signal', 'frequency', 'algorithm', 'network', 'protocol', 'anomaly', 'interface', 'transmission'],
    investigative: ['data', 'system', 'algorithm', 'decision', 'outcome', 'bias', 'model', 'case', 'impact', 'policy', 'evidence'],
    'self-help': ['practice', 'tool', 'strategy', 'resilience', 'boundary', 'self-care', 'burnout', 'sustainable', 'compassion', 'capacity'],
  };
  const relevantVocab = genreVocab[genre] || genreVocab.thriller;
  const genreWordHits = relevantVocab.filter(w => lowerText.includes(w)).length;
  let genreFitScore = 55 + Math.min(35, genreWordHits * 4);
  genreFitScore = Math.min(100, genreFitScore);

  // 7. Pacing/momentum
  const paraLengths = paragraphs.map(p => p.split(/\s+/).length);
  const paraLenStdDev = Math.sqrt(paraLengths.reduce((sum, l) => sum + (l - (paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length)) ** 2, 0) / Math.max(1, paraLengths.length));
  const dialogueLines = (text.match(/"/g) || []).length / 2;
  const dialogueRatio = dialogueLines / Math.max(1, paragraphs.length);
  let pacingScore = 60;
  pacingScore += Math.min(15, paraLenStdDev);
  pacingScore += Math.min(10, dialogueRatio > 0.2 ? 10 : dialogueRatio * 50);
  pacingScore += Math.min(10, actionVerbs > 10 ? 10 : actionVerbs);
  pacingScore = Math.min(100, pacingScore);

  // 8. Emotional charge
  const emotionWords = (text.match(/\b(fear|anger|love|hate|grief|joy|terror|despair|hope|rage|ache|burn|sting|throb|clench|shiver|tremble|gasp|sob|laugh|scream|whisper)\b/gi) || []).length;
  const physicalWords = (text.match(/\b(stomach|chest|throat|hands|fists|jaw|spine|pulse|breath|skin|sweat|tears|blood)\b/gi) || []).length;
  const emotionTelling = (text.match(/\bfelt (sad|happy|angry|scared|afraid|nervous|anxious)\b/gi) || []).length;
  let emotionScore = 55 + Math.min(15, emotionWords * 2) + Math.min(15, physicalWords * 2) - emotionTelling * 5;
  emotionScore = Math.max(20, Math.min(100, emotionScore));

  // 9. Dialogue naturalness
  const quoteCount = (text.match(/"/g) || []).length;
  const hasDialogue = quoteCount >= 4;
  const attributionVariety = new Set((text.match(/\b(said|asked|whispered|shouted|muttered|snapped|replied|answered|called|growled|sighed|laughed)\b/gi) || []).map(w => w.toLowerCase())).size;
  let dialogueScore = hasDialogue ? 65 : 45;
  dialogueScore += Math.min(15, attributionVariety * 3);
  if (hasDialogue && dialogueRatio > 0.15 && dialogueRatio < 0.6) dialogueScore += 10;
  dialogueScore = Math.min(100, dialogueScore);

  // 10. Specificity/concreteness
  const properNouns = (text.match(/\b[A-Z][a-z]{2,}\b/g) || []).length;
  const numbers = (text.match(/\b\d+\b/g) || []).length;
  let specificityScore = 55 + Math.min(15, properNouns > 20 ? 15 : properNouns * 0.75) + Math.min(10, numbers * 2);
  specificityScore = Math.min(100, specificityScore);

  // 11. Ending/page-turn effect
  const lastPara = paragraphs[paragraphs.length - 1] || '';
  const lastSentence = sentences[sentences.length - 1] || '';
  const lastSentWords = lastSentence.trim().split(/\s+/).length;
  const endHasQuestion = lastPara.includes('?');
  const endHasTension = /\b(but|however|except|until|before|never|still|yet|only|if)\b/i.test(lastPara);
  const endHasReveal = /\b(realized|discovered|saw|recognized|knew|understood|noticed)\b/i.test(lastPara);
  const endIsSummary = /\b(and so|in the end|that was|had been|all along)\b/i.test(lastSentence.toLowerCase());
  let endingScore = 60;
  if (endHasQuestion) endingScore += 10;
  if (endHasTension) endingScore += 10;
  if (endHasReveal) endingScore += 10;
  if (lastSentWords <= 15) endingScore += 5; // punchy ending
  if (endIsSummary) endingScore -= 15;
  endingScore = Math.max(20, Math.min(100, endingScore));

  // 12. Marketability (basic programmatic — mostly LLM-scored)
  const hasStrongConcept = project.seed_concept && project.seed_concept.length > 50;
  let marketScore = hasStrongConcept ? 75 : 60;
  marketScore += Math.min(10, hookScore > 80 ? 10 : 0);
  marketScore += Math.min(5, voiceScore > 75 ? 5 : 0);
  marketScore = Math.min(100, marketScore);

  const scores = {
    hook: hookScore,
    immediacy: immediacyScore,
    desire: desireScore,
    voice: voiceScore,
    polish: polishScore,
    genreFit: genreFitScore,
    pacing: pacingScore,
    emotion: emotionScore,
    dialogue: dialogueScore,
    specificity: specificityScore,
    ending: endingScore,
    marketability: marketScore,
  };

  // Weighted composite
  const weights = { hook: 10, immediacy: 8, desire: 9, voice: 10, polish: 8, genreFit: 8, pacing: 9, emotion: 8, dialogue: 7, specificity: 7, ending: 8, marketability: 8 };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const composite = Object.entries(scores).reduce((sum, [key, val]) => sum + val * (weights[key] || 8), 0) / totalWeight;

  return {
    scores,
    composite: Math.round(composite * 10) / 10,
    wordCount,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    slopCount,
    slopPhrases: AI_SLOP_PHRASES.filter(p => lowerText.includes(p.toLowerCase())),
    avgSentenceLength: Math.round(avgSentLen * 10) / 10,
    sentenceLengthStdDev: Math.round(sentStdDev * 10) / 10,
    uniqueWordRatio: Math.round(uniqueRatio * 1000) / 1000,
    dialogueRatio: Math.round(dialogueRatio * 100) / 100,
    adverbDensity: Math.round(adverbDensity * 10000) / 100 + '%',
  };
}

// ═══════════════════════════════════════════════════════════════
// QUALITY SCORING — LLM (publishing-critic)
// ═══════════════════════════════════════════════════════════════

async function llmScore(text, project, isNonfiction = false) {
  const rubricType = isNonfiction ? 'NONFICTION' : 'FICTION';
  const categories = isNonfiction
    ? ['thesis_clarity', 'authority', 'structural_logic', 'evidence_integration', 'reader_accessibility', 'narrative_energy', 'source_discipline', 'opening_strength', 'ending_strength', 'trade_appeal', 'originality', 'style_clarity']
    : ['hook_strength', 'scene_immediacy', 'character_desire', 'voice_distinctiveness', 'sentence_polish', 'genre_fit', 'pacing', 'emotional_charge', 'dialogue_naturalness', 'specificity', 'ending_effect', 'marketability'];

  const prompt = `You are a ruthless publishing industry quality scorer. Score this ${rubricType} chapter excerpt.

GENRE: ${project.genre || 'unknown'}
SUBGENRE: ${project.subgenre || ''}
TARGET AUDIENCE: ${project.target_audience || 'adult readers'}

Score each category 0-100. Be HONEST. Do not inflate scores. Commercial publishing standards.

Score bands:
- 90-100: Elite/blockbuster quality
- 80-89: Strong commercial quality
- 70-79: Publishable with editorial lift
- 60-69: Competent but generic
- Below 60: Not market-ready

Categories to score:
${categories.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Also identify:
- best_line: The single strongest line in the excerpt
- weakest_line: The single weakest line
- overall_verdict: One sentence assessment

Respond ONLY with valid JSON. No markdown fences. No preamble.

Schema:
{
  "scores": { ${categories.map(c => `"${c}": <number 0-100>`).join(', ')} },
  "composite": <number 0-100>,
  "best_line": "<string>",
  "weakest_line": "<string>",
  "overall_verdict": "<string>"
}

CHAPTER TEXT:
${text.slice(0, 12000)}`;

  try {
    const raw = await callOllama('publishing-critic', prompt, '', 0.3, 2000);
    // Try to parse JSON
    let cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    // Find first { to last }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      cleaned = cleaned.slice(start, end + 1);
    }
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('  ⚠️ LLM scoring failed, using programmatic only:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// POLISH SIMULATION
// ═══════════════════════════════════════════════════════════════

async function polishText(text, project) {
  const systemPrompt = `You are a prose polisher for ${project.genre || 'fiction'} manuscripts. Your job is to tighten prose, eliminate AI slop, strengthen verbs, sharpen dialogue, and improve rhythm while preserving the author's voice and all factual content. Do NOT add commentary. Return ONLY the polished chapter text.`;

  const prompt = `Polish this chapter. Preserve voice and all character/plot details. Eliminate weak verbs, filter words, AI-slop phrases, and passive voice where possible. Tighten sentences. Strengthen the opening hook and ending page-turn. Keep the same approximate length.

CHAPTER:
${text}

Return ONLY the polished chapter. No commentary.`;

  try {
    const polished = await callOllama('prose-polisher', prompt, systemPrompt, 0.3, 8000);
    if (polished.length < text.length * 0.5) {
      console.warn('  ⚠️ Polish output too short, using raw');
      return text;
    }
    return polished;
  } catch (err) {
    console.warn('  ⚠️ Polish failed, using raw:', err.message);
    return text;
  }
}

// ═══════════════════════════════════════════════════════════════
// SAFETY GATES
// ═══════════════════════════════════════════════════════════════

function runSafetyGates(text, project) {
  const manuscriptResult = runManuscriptSafetyGate(text, { project, stage: 'post-draft' });
  const exportResult = runPreExportSafetyGate(
    [{ content_md: text, chapter_number: 1, title: project.title || 'Chapter 1' }],
    { project, stage: 'pre-export' }
  );
  return { manuscriptResult, exportResult };
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  UBS BLOCKBUSTER QUALITY CALIBRATION                   ║');
  console.log('║  Generating prose through Ollama pipeline...           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const results = {};
  const bakeoffResults = [];
  const allOpenings = [];
  const allEndings = [];

  // ── Phase 1: Generate main projects ──
  for (const [key, project] of Object.entries(PROJECTS)) {
    console.log(`\n═══ PROJECT ${key}: ${project.label} ═══\n`);
    const isNF = project.book_type === 'nonfiction';

    // Build prompt
    console.log('  📝 Building prompt...');
    const prompt = buildChapterOnePrompt(project);
    console.log(`  📐 Prompt length: ${prompt.length} chars`);

    // Generate
    console.log('  🤖 Generating Chapter 1 via Ollama (ghostwriter)...');
    const startTime = Date.now();
    let rawText;
    try {
      rawText = await callOllama('ghostwriter', prompt, '', 0.72, 6000);
    } catch (err) {
      console.error(`  ❌ Generation failed: ${err.message}`);
      rawText = `[GENERATION FAILED: ${err.message}]`;
    }
    const genTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ⏱️  Generated in ${genTime}s (${rawText.split(/\s+/).length} words)`);

    // Score raw
    console.log('  📊 Scoring raw output...');
    const rawProgScore = programmaticScore(rawText, project);
    const rawLLMScore = await llmScore(rawText, project, isNF);

    // Polish
    console.log('  ✨ Polishing...');
    const polishedText = await polishText(rawText, project);
    const polishProgScore = programmaticScore(polishedText, project);
    const polishLLMScore = await llmScore(polishedText, project, isNF);

    // Safety gates
    console.log('  🛡️  Running safety gates...');
    const safety = runSafetyGates(polishedText, project);

    // Collect openings and endings
    const paragraphs = polishedText.split(/\n\n+/).filter(p => p.trim().length > 10);
    allOpenings.push({
      project: key,
      label: project.label,
      text: paragraphs.slice(0, 3).join('\n\n'),
      firstLine: (polishedText.split(/[.!?]/)[0] || '').trim(),
    });
    allEndings.push({
      project: key,
      label: project.label,
      text: paragraphs.slice(-3).join('\n\n'),
      lastLine: polishedText.trim().split(/\n/).pop().trim(),
    });

    results[key] = {
      project,
      rawText,
      polishedText,
      rawProgScore,
      rawLLMScore,
      polishProgScore,
      polishLLMScore,
      safety,
      genTime,
    };

    const rawComp = rawProgScore.composite;
    const polComp = polishProgScore.composite;
    const llmComp = polishLLMScore?.composite || 'N/A';
    console.log(`  📈 Raw: ${rawComp} | Polished: ${polComp} | LLM: ${llmComp}`);
    console.log(`  🛡️  Safety: ${safety.manuscriptResult.ok ? '✅ PASS' : '❌ FAIL'} | Export: ${!safety.exportResult.blocked ? '✅ PASS' : '❌ FAIL'}`);
  }

  // ── Phase 2: Style bakeoff ──
  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  STYLE BAKEOFF — 6 combinations, same premise          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  for (let i = 0; i < BAKEOFF_COMBOS.length; i++) {
    const combo = BAKEOFF_COMBOS[i];
    const project = makeProject({
      ...combo,
      book_type: 'fiction',
      content_lane: 'fiction',
      seed_concept: BAKEOFF_PREMISE,
      title: 'Voice from the Speakers',
      chapter_target: 20,
      chapter_length_target: 3500,
      reading_level: 'adult',
      spice_level: 0,
      language_intensity: 2,
    });

    console.log(`\n── Bakeoff ${i + 1}: ${combo.label} ──\n`);
    const prompt = buildChapterOnePrompt(project);

    console.log('  🤖 Generating...');
    const startTime = Date.now();
    let text;
    try {
      text = await callOllama('ghostwriter', prompt, '', 0.72, 5000);
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
      text = `[FAILED: ${err.message}]`;
    }
    const genTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ⏱️  ${genTime}s (${text.split(/\s+/).length} words)`);

    const progScore = programmaticScore(text, project);
    const llmResult = await llmScore(text, project);
    const safety = runSafetyGates(text, project);

    bakeoffResults.push({
      combo,
      project,
      text,
      progScore,
      llmResult,
      safety,
      genTime,
    });

    console.log(`  📈 Prog: ${progScore.composite} | LLM: ${llmResult?.composite || 'N/A'} | Safety: ${safety.manuscriptResult.ok ? '✅' : '❌'}`);

    // Collect openings/endings
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 10);
    allOpenings.push({
      project: `Bakeoff ${i + 1}`,
      label: combo.label,
      text: paragraphs.slice(0, 2).join('\n\n'),
      firstLine: (text.split(/[.!?]/)[0] || '').trim(),
    });
    allEndings.push({
      project: `Bakeoff ${i + 1}`,
      label: combo.label,
      text: paragraphs.slice(-2).join('\n\n'),
      lastLine: text.trim().split(/\n/).pop().trim(),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // REPORT GENERATION
  // ═══════════════════════════════════════════════════════════════
  console.log('\n\n═══ WRITING REPORTS ═══\n');

  writeReports(results, bakeoffResults, allOpenings, allEndings);

  console.log('\n✅ All reports written to smoke-test-output/blockbuster-quality-calibration/');
}

// ═══════════════════════════════════════════════════════════════
// REPORT WRITERS
// ═══════════════════════════════════════════════════════════════

function combineScores(prog, llm) {
  if (!llm || !llm.composite) return prog.composite;
  return Math.round((prog.composite * 0.4 + llm.composite * 0.6) * 10) / 10;
}

function getBand(score) {
  if (score >= 90) return '🟢 Elite';
  if (score >= 80) return '🟢 Strong Commercial';
  if (score >= 70) return '🟡 Publishable';
  if (score >= 60) return '🟠 Competent';
  return '🔴 Weak';
}

function writeReports(results, bakeoffResults, allOpenings, allEndings) {
  // ── Report 02: Fiction Blockbuster Quality Test ──
  const fictionKeys = ['A', 'B', 'C'];
  let r02 = `# Fiction Blockbuster Quality Test\n\n## Summary\n\n| Project | Label | Raw Score | Polished Score | LLM Score | Combined | Hook | Voice | Pacing | Market | Verdict |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;

  for (const key of fictionKeys) {
    const r = results[key];
    if (!r) continue;
    const combined = combineScores(r.polishProgScore, r.polishLLMScore);
    r02 += `| ${key} | ${r.project.label} | ${r.rawProgScore.composite} | ${r.polishProgScore.composite} | ${r.polishLLMScore?.composite || 'N/A'} | ${combined} | ${r.polishProgScore.scores.hook} | ${r.polishProgScore.scores.voice} | ${r.polishProgScore.scores.pacing} | ${r.polishProgScore.scores.marketability} | ${getBand(combined)} |\n`;
  }

  r02 += `\n## Detailed Results\n\n`;
  for (const key of fictionKeys) {
    const r = results[key];
    if (!r) continue;
    r02 += `### Project ${key}: ${r.project.label}\n\n`;
    r02 += `**Premise**: ${r.project.seed_concept}\n\n`;
    r02 += `**Settings**: ${r.project.genre} / ${r.project.subgenre} | Voice: ${r.project.author_voice} | POV: ${r.project.pov_mode} / ${r.project.tense} | Spice: ${r.project.spice_level}\n\n`;
    r02 += `**Generation**: ${r.genTime}s | ${r.rawProgScore.wordCount} words raw → ${r.polishProgScore.wordCount} words polished\n\n`;
    r02 += `**Slop phrases found**: ${r.polishProgScore.slopCount} ${r.polishProgScore.slopPhrases.length > 0 ? '(' + r.polishProgScore.slopPhrases.join(', ') + ')' : '(none)'}\n\n`;
    r02 += `**Safety**: Manuscript: ${r.safety.manuscriptResult.ok ? '✅ PASS' : '❌ FAIL'} | Export: ${!r.safety.exportResult.blocked ? '✅ PASS' : '❌ FAIL'}\n\n`;

    if (r.polishLLMScore) {
      r02 += `**LLM Verdict**: ${r.polishLLMScore.overall_verdict || 'N/A'}\n\n`;
      r02 += `**Best Line**: "${r.polishLLMScore.best_line || 'N/A'}"\n\n`;
      r02 += `**Weakest Line**: "${r.polishLLMScore.weakest_line || 'N/A'}"\n\n`;
    }

    r02 += `#### Programmatic Score Breakdown\n\n`;
    r02 += `| Category | Score |\n|---|---|\n`;
    for (const [cat, val] of Object.entries(r.polishProgScore.scores)) {
      r02 += `| ${cat} | ${val} |\n`;
    }

    r02 += `\n#### First Paragraph (Hook)\n\n`;
    const firstPara = r.polishedText.split(/\n\n+/).filter(p => p.trim().length > 10)[0] || '';
    r02 += `> ${firstPara.slice(0, 500)}\n\n`;

    r02 += `#### Last Paragraph (Ending)\n\n`;
    const paras = r.polishedText.split(/\n\n+/).filter(p => p.trim().length > 10);
    const lastPara = paras[paras.length - 1] || '';
    r02 += `> ${lastPara.slice(0, 500)}\n\n`;
    r02 += `---\n\n`;
  }

  // Fiction acceptance check
  const fictionScores = fictionKeys.map(k => results[k] ? combineScores(results[k].polishProgScore, results[k].polishLLMScore) : 0).filter(s => s > 0);
  const fictionAvg = fictionScores.reduce((a, b) => a + b, 0) / Math.max(1, fictionScores.length);
  const fictionMin = Math.min(...fictionScores);
  const fictionMax = Math.max(...fictionScores);
  const fictionSafetyOk = fictionKeys.every(k => !results[k] || (results[k].safety.manuscriptResult.ok && !results[k].safety.exportResult.blocked));

  r02 += `## Acceptance Criteria\n\n`;
  r02 += `| Criterion | Target | Actual | Result |\n|---|---|---|---|\n`;
  r02 += `| Average polished score | ≥ 82 | ${Math.round(fictionAvg * 10) / 10} | ${fictionAvg >= 82 ? '✅' : '⚠️'} |\n`;
  r02 += `| No output below | 78 | ${Math.round(fictionMin * 10) / 10} | ${fictionMin >= 78 ? '✅' : '⚠️'} |\n`;
  r02 += `| At least one reaches | 88 | ${Math.round(fictionMax * 10) / 10} | ${fictionMax >= 88 ? '✅' : '⚠️'} |\n`;
  r02 += `| Safety failures | 0 | ${fictionSafetyOk ? '0' : 'FAIL'} | ${fictionSafetyOk ? '✅' : '❌'} |\n`;

  writeFileSync(resolve(OUT, '02-fiction-blockbuster-quality-test.md'), r02);
  console.log('  ✅ 02-fiction-blockbuster-quality-test.md');

  // ── Report 03: Nonfiction Trade Quality Test ──
  const nfKeys = ['D', 'E'];
  let r03 = `# Nonfiction Trade Quality Test\n\n## Summary\n\n| Project | Label | Raw Score | Polished Score | LLM Score | Combined | Thesis | Authority | Structure | Evidence | Trade Appeal | Verdict |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;

  for (const key of nfKeys) {
    const r = results[key];
    if (!r) continue;
    const combined = combineScores(r.polishProgScore, r.polishLLMScore);
    const ls = r.polishLLMScore?.scores || {};
    r03 += `| ${key} | ${r.project.label} | ${r.rawProgScore.composite} | ${r.polishProgScore.composite} | ${r.polishLLMScore?.composite || 'N/A'} | ${combined} | ${ls.thesis_clarity || 'N/A'} | ${ls.authority || 'N/A'} | ${ls.structural_logic || 'N/A'} | ${ls.evidence_integration || 'N/A'} | ${ls.trade_appeal || 'N/A'} | ${getBand(combined)} |\n`;
  }

  r03 += `\n## Detailed Results\n\n`;
  for (const key of nfKeys) {
    const r = results[key];
    if (!r) continue;
    r03 += `### Project ${key}: ${r.project.label}\n\n`;
    r03 += `**Premise**: ${r.project.seed_concept}\n\n`;
    r03 += `**Settings**: ${r.project.genre} / ${r.project.subgenre} | Structure: ${r.project.nf_structure_mode} | POV: ${r.project.pov_mode}\n\n`;
    r03 += `**Generation**: ${r.genTime}s | ${r.rawProgScore.wordCount} words raw → ${r.polishProgScore.wordCount} words polished\n\n`;
    r03 += `**Safety**: Manuscript: ${r.safety.manuscriptResult.ok ? '✅ PASS' : '❌ FAIL'} | Export: ${!r.safety.exportResult.blocked ? '✅ PASS' : '❌ FAIL'}\n\n`;
    r03 += `**Reference Integrity**: ${r.safety.exportResult.referenceReport ? 'Ran ✅' : 'Skipped'}\n\n`;

    if (r.polishLLMScore) {
      r03 += `**LLM Verdict**: ${r.polishLLMScore.overall_verdict || 'N/A'}\n\n`;
    }

    r03 += `#### First Paragraph\n\n`;
    const firstPara = r.polishedText.split(/\n\n+/).filter(p => p.trim().length > 10)[0] || '';
    r03 += `> ${firstPara.slice(0, 500)}\n\n`;
    r03 += `---\n\n`;
  }

  const nfScores = nfKeys.map(k => results[k] ? combineScores(results[k].polishProgScore, results[k].polishLLMScore) : 0).filter(s => s > 0);
  const nfAvg = nfScores.reduce((a, b) => a + b, 0) / Math.max(1, nfScores.length);
  const nfMin = Math.min(...nfScores);

  r03 += `## Acceptance Criteria\n\n`;
  r03 += `| Criterion | Target | Actual | Result |\n|---|---|---|---|\n`;
  r03 += `| Average polished score | ≥ 84 | ${Math.round(nfAvg * 10) / 10} | ${nfAvg >= 84 ? '✅' : '⚠️'} |\n`;
  r03 += `| No output below | 80 | ${Math.round(nfMin * 10) / 10} | ${nfMin >= 80 ? '✅' : '⚠️'} |\n`;

  writeFileSync(resolve(OUT, '03-nonfiction-trade-quality-test.md'), r03);
  console.log('  ✅ 03-nonfiction-trade-quality-test.md');

  // ── Report 04: Style Control Quality Bakeoff ──
  let r04 = `# Style Control Quality Bakeoff\n\n## Premise\n> ${BAKEOFF_PREMISE}\n\n## Results\n\n| # | Combination | Prog Score | LLM Score | Combined | Genre Fit | Hook | Voice | Safety | Verdict |\n|---|---|---|---|---|---|---|---|---|---|\n`;

  for (let i = 0; i < bakeoffResults.length; i++) {
    const b = bakeoffResults[i];
    const combined = combineScores(b.progScore, b.llmResult);
    r04 += `| ${i + 1} | ${b.combo.label} | ${b.progScore.composite} | ${b.llmResult?.composite || 'N/A'} | ${combined} | ${b.progScore.scores.genreFit} | ${b.progScore.scores.hook} | ${b.progScore.scores.voice} | ${b.safety.manuscriptResult.ok ? '✅' : '❌'} | ${getBand(combined)} |\n`;
  }

  // Style distinctiveness check
  r04 += `\n## Style Distinctiveness\n\n`;
  r04 += `Each combination should produce CLEARLY DIFFERENT prose. Checking first sentences:\n\n`;
  for (let i = 0; i < bakeoffResults.length; i++) {
    const first = (bakeoffResults[i].text.split(/[.!?]/)[0] || '').trim();
    r04 += `**${i + 1}. ${bakeoffResults[i].combo.label}**: "${first.slice(0, 150)}"\n\n`;
  }

  // Check all first sentences are different
  const firstSentences = bakeoffResults.map(b => (b.text.split(/[.!?]/)[0] || '').trim().toLowerCase());
  const uniqueFirstSentences = new Set(firstSentences).size;
  r04 += `\n**Unique opening sentences**: ${uniqueFirstSentences}/${bakeoffResults.length} ${uniqueFirstSentences === bakeoffResults.length ? '✅' : '⚠️ Some openings too similar'}\n\n`;

  const bakeoffScores = bakeoffResults.map(b => combineScores(b.progScore, b.llmResult));
  const bakeoffAvg = bakeoffScores.reduce((a, b) => a + b, 0) / Math.max(1, bakeoffScores.length);
  const bakeoffMin = Math.min(...bakeoffScores);

  r04 += `## Acceptance Criteria\n\n`;
  r04 += `| Criterion | Target | Actual | Result |\n|---|---|---|---|\n`;
  r04 += `| Average score | ≥ 82 | ${Math.round(bakeoffAvg * 10) / 10} | ${bakeoffAvg >= 82 ? '✅' : '⚠️'} |\n`;
  r04 += `| No combination below | 75 | ${Math.round(bakeoffMin * 10) / 10} | ${bakeoffMin >= 75 ? '✅' : '⚠️'} |\n`;
  r04 += `| All combinations distinct | Yes | ${uniqueFirstSentences === bakeoffResults.length ? 'Yes' : 'No'} | ${uniqueFirstSentences === bakeoffResults.length ? '✅' : '⚠️'} |\n`;

  writeFileSync(resolve(OUT, '04-style-control-quality-bakeoff.md'), r04);
  console.log('  ✅ 04-style-control-quality-bakeoff.md');

  // ── Report 05: Opening/Ending Strength ──
  let r05 = `# Opening & Ending Strength Report\n\n## Openings\n\n| Project | Label | First Line | Opening Score |\n|---|---|---|---|\n`;

  for (const o of allOpenings) {
    const firstLine = o.firstLine.slice(0, 100);
    // Simple opening score based on hook analysis
    const hasName = /[A-Z][a-z]{2,}/.test(o.firstLine);
    const hasAction = /\b(discovered|ran|pulled|slammed|whispered|stared|grabbed|opened|stepped|turned|heard|saw)\b/i.test(o.firstLine);
    const noGeneric = !(/^(The (morning|evening|sun|rain)|It was a|Once upon|There was)/i.test(o.firstLine.trim()));
    const openingScore = 60 + (hasName ? 10 : 0) + (hasAction ? 10 : 0) + (noGeneric ? 10 : 0) + (o.firstLine.length > 30 && o.firstLine.length < 200 ? 5 : 0);
    r05 += `| ${o.project} | ${o.label} | "${firstLine}..." | ${Math.min(100, openingScore)} |\n`;
  }

  r05 += `\n## Endings\n\n| Project | Label | Last Line | Ending Score |\n|---|---|---|---|\n`;

  for (const e of allEndings) {
    const lastLine = e.lastLine.slice(0, 100);
    const hasTension = /\b(but|however|yet|still|only|never|until)\b/i.test(e.lastLine);
    const hasReveal = /\b(realized|discovered|saw|recognized|knew|understood)\b/i.test(e.lastLine);
    const isSummary = /\b(and so|in the end|that was|had been)\b/i.test(e.lastLine);
    const endingScore = 60 + (hasTension ? 12 : 0) + (hasReveal ? 12 : 0) + (e.lastLine.length < 100 ? 5 : 0) - (isSummary ? 15 : 0);
    r05 += `| ${e.project} | ${e.label} | "${lastLine}..." | ${Math.max(40, Math.min(100, endingScore))} |\n`;
  }

  r05 += `\n## Sample Openings\n\n`;
  for (const o of allOpenings.slice(0, 5)) {
    r05 += `### ${o.project}: ${o.label}\n\n> ${o.text.slice(0, 400)}\n\n`;
  }

  r05 += `## Sample Endings\n\n`;
  for (const e of allEndings.slice(0, 5)) {
    r05 += `### ${e.project}: ${e.label}\n\n> ${e.text.slice(0, 400)}\n\n`;
  }

  writeFileSync(resolve(OUT, '05-opening-ending-strength-report.md'), r05);
  console.log('  ✅ 05-opening-ending-strength-report.md');

  // ── Report 06: Marketability ──
  let r06 = `# Marketability & Reader Hook Report\n\n`;
  r06 += `| Project | Label | Concept | Execution | Market Fit | Hook | Commercial Potential | Verdict |\n|---|---|---|---|---|---|---|---|\n`;

  for (const [key, r] of Object.entries(results)) {
    const concept = r.project.seed_concept.length > 80 ? 82 : 75;
    const execution = r.polishProgScore.composite;
    const marketFit = r.polishProgScore.scores.genreFit;
    const hook = r.polishProgScore.scores.hook;
    const commercial = Math.round((concept * 0.25 + execution * 0.3 + marketFit * 0.2 + hook * 0.25) * 10) / 10;
    r06 += `| ${key} | ${r.project.label} | ${concept} | ${execution} | ${marketFit} | ${hook} | ${commercial} | ${getBand(commercial)} |\n`;
  }

  r06 += `\n## Concept Analysis\n\n`;
  for (const [key, r] of Object.entries(results)) {
    r06 += `### Project ${key}: ${r.project.label}\n\n`;
    r06 += `- **Logline**: ${r.project.seed_concept}\n`;
    r06 += `- **Genre Position**: ${r.project.genre} / ${r.project.subgenre}\n`;
    r06 += `- **Target Reader**: ${r.project.target_audience}\n`;
    r06 += `- **Hook Clarity**: ${r.polishProgScore.scores.hook >= 80 ? 'Strong — immediate question raised' : 'Needs sharpening'}\n`;
    r06 += `- **Series Potential**: ${['Thriller', 'Mystery', 'Romance'].includes(r.project.genre) ? 'High — character/concept supports series' : 'Moderate — standalone or limited series'}\n\n`;
  }

  writeFileSync(resolve(OUT, '06-marketability-and-reader-hook-report.md'), r06);
  console.log('  ✅ 06-marketability-and-reader-hook-report.md');

  // ── Report 08: Final Verdict ──
  const allFictionCombined = fictionKeys.map(k => results[k] ? combineScores(results[k].polishProgScore, results[k].polishLLMScore) : 0).filter(s => s > 0);
  const allNFCombined = nfKeys.map(k => results[k] ? combineScores(results[k].polishProgScore, results[k].polishLLMScore) : 0).filter(s => s > 0);

  const overallFictionAvg = allFictionCombined.reduce((a, b) => a + b, 0) / Math.max(1, allFictionCombined.length);
  const overallNFAvg = allNFCombined.reduce((a, b) => a + b, 0) / Math.max(1, allNFCombined.length);
  const overallFictionMin = allFictionCombined.length > 0 ? Math.min(...allFictionCombined) : 0;
  const overallNFMin = allNFCombined.length > 0 ? Math.min(...allNFCombined) : 0;
  const allSafetyPassed = Object.values(results).every(r => r.safety.manuscriptResult.ok && !r.safety.exportResult.blocked)
    && bakeoffResults.every(b => b.safety.manuscriptResult.ok);

  let verdict = 'FAIL';
  if (overallFictionAvg >= 82 && overallNFAvg >= 84 && overallFictionMin >= 78 && overallNFMin >= 80 && allSafetyPassed && bakeoffAvg >= 82) {
    verdict = 'FINAL PASS';
  } else if (overallFictionAvg >= 78 && overallNFAvg >= 80 && allSafetyPassed) {
    verdict = 'PASS WITH NOTES';
  } else if (overallFictionAvg >= 70 && overallNFAvg >= 72 && allSafetyPassed) {
    verdict = 'PARTIAL PASS';
  }

  let r08 = `# Final Verdict: ${verdict}\n\n`;

  r08 += `## TABLE 1 — Fiction Quality Scores\n\n`;
  r08 += `| Project | Raw | Polished | LLM | Combined | Verdict |\n|---|---|---|---|---|---|\n`;
  for (const key of fictionKeys) {
    const r = results[key];
    if (!r) continue;
    const combined = combineScores(r.polishProgScore, r.polishLLMScore);
    r08 += `| ${key}: ${r.project.label} | ${r.rawProgScore.composite} | ${r.polishProgScore.composite} | ${r.polishLLMScore?.composite || 'N/A'} | ${combined} | ${getBand(combined)} |\n`;
  }
  r08 += `| **Average** | | | | **${Math.round(overallFictionAvg * 10) / 10}** | |\n\n`;

  r08 += `## TABLE 2 — Nonfiction Quality Scores\n\n`;
  r08 += `| Project | Raw | Polished | LLM | Combined | Verdict |\n|---|---|---|---|---|---|\n`;
  for (const key of nfKeys) {
    const r = results[key];
    if (!r) continue;
    const combined = combineScores(r.polishProgScore, r.polishLLMScore);
    r08 += `| ${key}: ${r.project.label} | ${r.rawProgScore.composite} | ${r.polishProgScore.composite} | ${r.polishLLMScore?.composite || 'N/A'} | ${combined} | ${getBand(combined)} |\n`;
  }
  r08 += `| **Average** | | | | **${Math.round(overallNFAvg * 10) / 10}** | |\n\n`;

  r08 += `## TABLE 3 — Style Bakeoff\n\n`;
  r08 += `| # | Combination | Score | Result |\n|---|---|---|---|\n`;
  for (let i = 0; i < bakeoffResults.length; i++) {
    const combined = combineScores(bakeoffResults[i].progScore, bakeoffResults[i].llmResult);
    r08 += `| ${i + 1} | ${bakeoffResults[i].combo.label} | ${combined} | ${getBand(combined)} |\n`;
  }
  r08 += `| **Average** | | **${Math.round(bakeoffAvg * 10) / 10}** | |\n\n`;

  r08 += `## TABLE 4 — Opening/Ending Strength\n\n`;
  r08 += `| Project | Opening Score | Ending Score | Result |\n|---|---|---|---|\n`;
  for (const o of allOpenings.slice(0, 5)) {
    const hasName = /[A-Z][a-z]{2,}/.test(o.firstLine);
    const openScore = 65 + (hasName ? 10 : 0) + (o.firstLine.length > 30 ? 5 : 0);
    const e = allEndings.find(e => e.project === o.project) || {};
    const endScore = 65 + (/\b(but|yet|still|only)\b/i.test(e.lastLine || '') ? 10 : 0);
    r08 += `| ${o.project}: ${o.label} | ${Math.min(100, openScore)} | ${Math.min(100, endScore)} | ${getBand(Math.min(100, (openScore + endScore) / 2))} |\n`;
  }

  r08 += `\n## TABLE 5 — Marketability\n\n`;
  r08 += `| Project | Commercial Potential | Result |\n|---|---|---|\n`;
  for (const [key, r] of Object.entries(results)) {
    const cp = Math.round((82 * 0.25 + r.polishProgScore.composite * 0.3 + r.polishProgScore.scores.genreFit * 0.2 + r.polishProgScore.scores.hook * 0.25) * 10) / 10;
    r08 += `| ${key}: ${r.project.label} | ${cp} | ${getBand(cp)} |\n`;
  }

  r08 += `\n## TABLE 6 — Safety\n\n`;
  r08 += `| Check | Result |\n|---|---|\n`;
  r08 += `| Process leaks (all projects) | ${Object.values(results).every(r => !r.safety.manuscriptResult.processLeaks?.hasLeak) ? '✅ None' : '❌ DETECTED'} |\n`;
  r08 += `| Contamination (all projects) | ${Object.values(results).every(r => !r.safety.manuscriptResult.contamination?.hasContamination) ? '✅ None' : '❌ DETECTED'} |\n`;
  r08 += `| Malformed output | ${Object.values(results).every(r => !r.safety.manuscriptResult.malformed?.hasMalformed) ? '✅ None' : '⚠️ Some'} |\n`;
  r08 += `| Export safety (all projects) | ${Object.values(results).every(r => !r.safety.exportResult.blocked) ? '✅ All pass' : '❌ BLOCKED'} |\n`;
  r08 += `| Bakeoff safety | ${bakeoffResults.every(b => b.safety.manuscriptResult.ok) ? '✅ All pass' : '❌ FAIL'} |\n`;

  r08 += `\n## TABLE 7 — Weaknesses\n\n`;
  r08 += `| Weakness | Severity | Recommendation |\n|---|---|---|\n`;

  // Identify weaknesses from scores
  for (const [key, r] of Object.entries(results)) {
    for (const [cat, val] of Object.entries(r.polishProgScore.scores)) {
      if (val < 65) {
        r08 += `| ${key}: ${cat} scored ${val} | High | Improve ${cat} prompt engineering |\n`;
      } else if (val < 75) {
        r08 += `| ${key}: ${cat} scored ${val} | Medium | Tune ${cat} for ${r.project.genre} |\n`;
      }
    }
    if (r.polishProgScore.slopCount > 0) {
      r08 += `| ${key}: ${r.polishProgScore.slopCount} slop phrases | Medium | Strengthen anti-slop enforcement |\n`;
    }
  }

  r08 += `\n## TABLE 8 — Regression\n\n`;
  r08 += `| Suite | Result |\n|---|---|\n`;
  r08 += `| Quality calibration generation | ✅ Complete |\n`;
  r08 += `| Safety gates | ${allSafetyPassed ? '✅ All pass' : '❌ Failures'} |\n`;
  r08 += `| npm run test:polish-pipeline | (Run separately) |\n`;
  r08 += `| npx vite build | (Run separately) |\n`;

  r08 += `\n## Acceptance Summary\n\n`;
  r08 += `| Criterion | Target | Actual | Result |\n|---|---|---|---|\n`;
  r08 += `| Fiction average | ≥ 82 | ${Math.round(overallFictionAvg * 10) / 10} | ${overallFictionAvg >= 82 ? '✅' : '⚠️'} |\n`;
  r08 += `| Fiction minimum | ≥ 78 | ${Math.round(overallFictionMin * 10) / 10} | ${overallFictionMin >= 78 ? '✅' : '⚠️'} |\n`;
  r08 += `| Nonfiction average | ≥ 84 | ${Math.round(overallNFAvg * 10) / 10} | ${overallNFAvg >= 84 ? '✅' : '⚠️'} |\n`;
  r08 += `| Nonfiction minimum | ≥ 80 | ${Math.round(overallNFMin * 10) / 10} | ${overallNFMin >= 80 ? '✅' : '⚠️'} |\n`;
  r08 += `| Bakeoff average | ≥ 82 | ${Math.round(bakeoffAvg * 10) / 10} | ${bakeoffAvg >= 82 ? '✅' : '⚠️'} |\n`;
  r08 += `| Safety | All pass | ${allSafetyPassed ? 'All pass' : 'FAIL'} | ${allSafetyPassed ? '✅' : '❌'} |\n`;

  writeFileSync(resolve(OUT, '08-final-verdict.md'), r08);
  console.log('  ✅ 08-final-verdict.md');

  // Save raw results as JSON for regression test consumption
  const cacheData = {};
  for (const [key, r] of Object.entries(results)) {
    cacheData[key] = {
      label: r.project.label,
      genre: r.project.genre,
      bookType: r.project.book_type,
      rawText: r.rawText,
      polishedText: r.polishedText,
      rawProgScore: r.rawProgScore,
      polishProgScore: r.polishProgScore,
      rawLLMScore: r.rawLLMScore,
      polishLLMScore: r.polishLLMScore,
      safety: {
        manuscriptOk: r.safety.manuscriptResult.ok,
        exportBlocked: r.safety.exportResult.blocked,
        processLeaks: r.safety.manuscriptResult.processLeaks?.hasLeak || false,
        contamination: r.safety.manuscriptResult.contamination?.hasContamination || false,
      },
    };
  }
  cacheData._bakeoff = bakeoffResults.map(b => ({
    label: b.combo.label,
    genre: b.combo.genre,
    text: b.text,
    progScore: b.progScore,
    llmScore: b.llmResult,
    safetyOk: b.safety.manuscriptResult.ok,
  }));
  writeFileSync(resolve(OUT, 'calibration-results.json'), JSON.stringify(cacheData, null, 2));
  console.log('  ✅ calibration-results.json (cached for regression tests)');

  console.log(`\n══════════════════════════════════════════════════════`);
  console.log(`  VERDICT: ${verdict}`);
  console.log(`  Fiction avg: ${Math.round(overallFictionAvg * 10) / 10} | NF avg: ${Math.round(overallNFAvg * 10) / 10}`);
  console.log(`  Bakeoff avg: ${Math.round(bakeoffAvg * 10) / 10} | Safety: ${allSafetyPassed ? 'ALL PASS' : 'FAILURES'}`);
  console.log(`══════════════════════════════════════════════════════\n`);
}

// Run
main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
