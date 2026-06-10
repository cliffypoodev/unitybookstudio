/**
 * qualityCalibrationRerun.mjs
 *
 * Re-runs only the contamination-failed outputs (E, Bakeoff 4, Bakeoff 6)
 * with anti-contamination prompt suffix, patches cached results, rewrites reports.
 *
 * Usage: node --loader ./tests/loader.mjs tests/qualityCalibrationRerun.mjs
 */

import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

import {
  buildProjectContextHeader,
  createInitialProjectSettings,
  computeTotalWordTarget,
  applyGenreDefaults,
  buildSpiceBeatInstructions,
} from '../src/lib/autonovel.js';
import { buildSetupConstraints } from '../src/lib/setupConstraints.js';
import { buildPovTenseBlock } from '../src/lib/povTense.js';
import { buildPacingBlock } from '../src/lib/pacingModulation.js';
import { runManuscriptSafetyGate } from '../src/lib/manuscriptSafetyGate.js';
import { runPreExportSafetyGate } from '../src/lib/exportSafetyGate.js';

const OLLAMA = 'http://127.0.0.1:11434';
const OUT = resolve('smoke-test-output/blockbuster-quality-calibration');

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
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  let text = data?.message?.content || '';
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/think>/gi, '').replace(/\\boxed\{[^}]*\}/g, '').trim();
  return text;
}

function makeProject(overrides) {
  const base = createInitialProjectSettings(overrides.book_type || 'fiction');
  const merged = { ...base, ...overrides };
  if (overrides.genre) { try { Object.assign(merged, applyGenreDefaults(merged, overrides.genre)); } catch {} }
  Object.assign(merged, overrides);
  merged.total_word_target = computeTotalWordTarget(merged.chapter_target, merged.chapter_length_target);
  return merged;
}

// Anti-contamination suffix (matches what the real pipeline uses on retry)
const ANTI_CONTAMINATION = `

CRITICAL: DO NOT REFERENCE OTHER PROJECTS OR ORGANIZATIONS.
The following terms are FORBIDDEN in this manuscript: "Unity Supported Living Services", "Unity Supported Living", "Unity Media Solutions", "Unity Media", "care documentation", "compliance documentation", "AI content pipeline", "premium digital resource hub".
Do not mention real companies, business plans, funding streams, or app launches unless they are explicitly part of this story's world.
Write only within the world and characters of THIS project.`;

function buildChapterOnePrompt(project) {
  const header = buildProjectContextHeader(project);
  const constraints = buildSetupConstraints(project);
  const povBlock = buildPovTenseBlock(project);
  const pacingBlock = buildPacingBlock(project, { chapter_number: 1 });
  const spiceBlock = buildSpiceBeatInstructions(project) || '';
  const isNF = project.book_type === 'nonfiction';
  const wordTarget = project.chapter_length_target || 3500;
  const sceneBeat = isNF
    ? `Write Chapter 1 of this nonfiction book. Open with a vivid scene, case study, or anecdote that immediately illustrates the book's central thesis. Establish authority and urgency.`
    : `Write Chapter 1 of this novel. Open with a scene that establishes the protagonist, the world, and the central tension. The first sentence must hook the reader. End the chapter with a page-turn moment.`;

  return `${header}\n\n${constraints}\n\n${povBlock}\n\n${pacingBlock}\n${spiceBlock ? '\n' + spiceBlock : ''}

── CHAPTER 1 DRAFTING INSTRUCTIONS ──

${sceneBeat}

PREMISE: ${project.seed_concept}

TARGET: ~${wordTarget} words for this chapter.

QUALITY MANDATE:
- First sentence must be UNFORGETTABLE.
- Every paragraph must do work.
- Dialogue must sound like real people talking.
- Use concrete, specific details.
- End with a page-turn moment.
- Zero AI slop.
- No process commentary.
${ANTI_CONTAMINATION}

Write Chapter 1 now. Output ONLY the chapter prose.`;
}

// AI slop phrases for scoring
const AI_SLOP_PHRASES = [
  'delve', 'tapestry', 'testament to', 'landscape of', 'dance of', 'symphony of',
  'a sense of', 'palpable', 'sending shivers', 'echoed through', 'pierced the',
  'shattered the silence', 'hung in the air', 'cut through', 'world of', 'realm of',
  'nestled', 'labyrinthine', 'kaleidoscope', 'crucible of', 'ever-evolving', 'myriad',
  'a wave of', 'a surge of', 'a mixture of', 'couldn\'t help but',
];

function quickScore(text, project) {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 10);
  const lowerText = text.toLowerCase();

  const firstSentence = sentences[0] || '';
  const hasName = /[A-Z][a-z]{2,}/.test(firstSentence);
  const hasAction = /\b(discovered|ran|pulled|slammed|whispered|stared|grabbed|opened|stepped|turned|heard|saw|felt|pressed)\b/i.test(firstSentence);
  const noGeneric = !(/^(The (morning|evening|sun|rain)|It was a|Once upon|There (was|were)|In the)\b/i.test(firstSentence.trim()));
  let hookScore = 60 + (hasName ? 8 : 0) + (hasAction ? 8 : 0) + (noGeneric ? 8 : 0);
  hookScore += (firstSentence.includes('?') || /but |yet |when /.test(firstSentence.toLowerCase())) ? 8 : 0;
  hookScore += (firstSentence.trim().split(/\s+/).length >= 10 && firstSentence.trim().split(/\s+/).length <= 45) ? 8 : 0;

  const sentLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgLen = sentLengths.reduce((a, b) => a + b, 0) / Math.max(1, sentLengths.length);
  const stdDev = Math.sqrt(sentLengths.reduce((sum, l) => sum + (l - avgLen) ** 2, 0) / Math.max(1, sentLengths.length));
  const uniqueRatio = new Set(words.map(w => w.toLowerCase())).size / Math.max(1, wordCount);
  const slopCount = AI_SLOP_PHRASES.filter(p => lowerText.includes(p.toLowerCase())).length;
  let voiceScore = 50 + Math.min(15, stdDev * 2) + Math.min(15, uniqueRatio > 0.45 ? 15 : uniqueRatio * 30) - slopCount * 4;

  const SENSORY = ['see', 'saw', 'heard', 'smell', 'taste', 'touch', 'cold', 'warm', 'hot', 'sharp', 'bright', 'dark', 'loud', 'bitter', 'metallic', 'damp'];
  const firstPara = paragraphs[0] || '';
  const sensoryCount = SENSORY.filter(w => firstPara.toLowerCase().includes(w)).length;
  let immediacyScore = 55 + Math.min(20, sensoryCount * 5) + (!firstPara.toLowerCase().includes('there was') ? 8 : 0) + (/[A-Z][a-z]+/.test(firstPara) ? 5 : 0);

  const actionVerbs = (text.match(/\b(need|want|must|had to|couldn't|wouldn't|refused|demanded|fought|struggled|pushed|pulled|forced|tried|failed)\b/gi) || []).length;
  const namedChars = (text.match(/[A-Z][a-z]{2,}/g) || []).length;
  let desireScore = 55 + Math.min(20, actionVerbs * 2) + Math.min(10, namedChars > 3 ? 10 : namedChars * 3);

  const adverbs = (text.match(/\b\w+ly\b/g) || []).filter(w => !['only', 'early', 'family', 'really', 'likely', 'lonely', 'finally'].includes(w.toLowerCase()));
  const passiveCount = [' was ', ' were ', ' been ', ' being '].filter(p => lowerText.includes(p)).length;
  const filterCount = ['seemed', 'appeared', 'felt like', 'sort of', 'kind of', 'basically', 'actually', 'really', 'very', 'just'].filter(w => lowerText.includes(w)).length;
  let polishScore = 80 - Math.min(20, (adverbs.length / Math.max(1, wordCount)) * 500) - Math.min(15, passiveCount * 2) - Math.min(15, filterCount * 2) - slopCount * 5;

  const genre = (project?.genre || '').toLowerCase();
  const gv = { thriller: ['stakes', 'deadline', 'threat', 'target', 'protocol'], horror: ['dread', 'shadow', 'wrong', 'darkness', 'silence'], romance: ['chemistry', 'tension', 'desire', 'warmth', 'touch'], mystery: ['clue', 'evidence', 'suspect', 'witness', 'motive'], 'literary fiction': ['silence', 'memory', 'light', 'distance', 'ordinary'], 'science fiction': ['system', 'data', 'signal', 'frequency', 'algorithm'], investigative: ['data', 'system', 'algorithm', 'decision', 'outcome'], 'self-help': ['practice', 'tool', 'strategy', 'resilience', 'boundary'] };
  const genreHits = (gv[genre] || gv.thriller).filter(w => lowerText.includes(w)).length;
  let genreFitScore = 55 + Math.min(35, genreHits * 7);

  const paraLengths = paragraphs.map(p => p.split(/\s+/).length);
  const paraStdDev = Math.sqrt(paraLengths.reduce((sum, l) => sum + (l - (paraLengths.reduce((a, b) => a + b, 0) / Math.max(1, paraLengths.length))) ** 2, 0) / Math.max(1, paraLengths.length));
  const dialogueLines = (text.match(/"/g) || []).length / 2;
  const dialogueRatio = dialogueLines / Math.max(1, paragraphs.length);
  let pacingScore = 60 + Math.min(15, paraStdDev) + Math.min(10, dialogueRatio > 0.2 ? 10 : dialogueRatio * 50) + Math.min(10, actionVerbs > 10 ? 10 : actionVerbs);

  const emotionWords = (text.match(/\b(fear|anger|love|hate|grief|joy|terror|despair|hope|rage|ache|burn|sting|throb|clench|shiver|tremble|gasp|sob|laugh|scream|whisper)\b/gi) || []).length;
  const physicalWords = (text.match(/\b(stomach|chest|throat|hands|fists|jaw|spine|pulse|breath|skin|sweat|tears|blood)\b/gi) || []).length;
  let emotionScore = 55 + Math.min(15, emotionWords * 2) + Math.min(15, physicalWords * 2);

  const hasDialogue = (text.match(/"/g) || []).length >= 4;
  const attrVariety = new Set((text.match(/\b(said|asked|whispered|shouted|muttered|snapped|replied|answered|called|growled|sighed)\b/gi) || []).map(w => w.toLowerCase())).size;
  let dialogueScore = (hasDialogue ? 65 : 45) + Math.min(15, attrVariety * 3) + (hasDialogue && dialogueRatio > 0.15 && dialogueRatio < 0.6 ? 10 : 0);

  const properNouns = (text.match(/\b[A-Z][a-z]{2,}\b/g) || []).length;
  let specificityScore = 55 + Math.min(15, properNouns > 20 ? 15 : properNouns * 0.75) + Math.min(10, (text.match(/\b\d+\b/g) || []).length * 2);

  const lastPara = paragraphs[paragraphs.length - 1] || '';
  const lastSent = sentences[sentences.length - 1] || '';
  let endingScore = 60 + (lastPara.includes('?') ? 10 : 0) + (/\b(but|however|yet|still|only|never|until)\b/i.test(lastPara) ? 10 : 0) + (/\b(realized|discovered|saw|recognized|knew|understood)\b/i.test(lastPara) ? 10 : 0) + (lastSent.trim().split(/\s+/).length <= 15 ? 5 : 0);
  if (/\b(and so|in the end|that was|had been|all along)\b/i.test(lastSent.toLowerCase())) endingScore -= 15;

  let marketScore = (project.seed_concept && project.seed_concept.length > 50 ? 75 : 60) + (hookScore > 80 ? 10 : 0) + (voiceScore > 75 ? 5 : 0);

  const scores = {
    hook: Math.min(100, Math.max(20, hookScore)),
    immediacy: Math.min(100, Math.max(20, immediacyScore)),
    desire: Math.min(100, Math.max(20, desireScore)),
    voice: Math.min(100, Math.max(20, voiceScore)),
    polish: Math.min(100, Math.max(20, polishScore)),
    genreFit: Math.min(100, Math.max(20, genreFitScore)),
    pacing: Math.min(100, Math.max(20, pacingScore)),
    emotion: Math.min(100, Math.max(20, emotionScore)),
    dialogue: Math.min(100, Math.max(20, dialogueScore)),
    specificity: Math.min(100, Math.max(20, specificityScore)),
    ending: Math.min(100, Math.max(20, endingScore)),
    marketability: Math.min(100, Math.max(20, marketScore)),
  };
  const weights = { hook: 10, immediacy: 8, desire: 9, voice: 10, polish: 8, genreFit: 8, pacing: 9, emotion: 8, dialogue: 7, specificity: 7, ending: 8, marketability: 8 };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const composite = Object.entries(scores).reduce((sum, [key, val]) => sum + val * (weights[key] || 8), 0) / totalWeight;
  return { scores, composite: Math.round(composite * 10) / 10, wordCount, slopCount, slopPhrases: AI_SLOP_PHRASES.filter(p => lowerText.includes(p.toLowerCase())) };
}

async function llmScore(text, project, isNF = false) {
  const cats = isNF
    ? ['thesis_clarity', 'authority', 'structural_logic', 'evidence_integration', 'reader_accessibility', 'narrative_energy', 'source_discipline', 'opening_strength', 'ending_strength', 'trade_appeal', 'originality', 'style_clarity']
    : ['hook_strength', 'scene_immediacy', 'character_desire', 'voice_distinctiveness', 'sentence_polish', 'genre_fit', 'pacing', 'emotional_charge', 'dialogue_naturalness', 'specificity', 'ending_effect', 'marketability'];
  const prompt = `You are a publishing quality scorer. Score this ${isNF ? 'NONFICTION' : 'FICTION'} chapter 0-100 per category. Genre: ${project.genre}. Be honest.
Categories: ${cats.join(', ')}
Respond with JSON only: { "scores": {...}, "composite": <0-100>, "best_line": "...", "weakest_line": "...", "overall_verdict": "..." }
CHAPTER:\n${text.slice(0, 12000)}`;
  try {
    const raw = await callOllama('publishing-critic', prompt, '', 0.3, 2000);
    let cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) cleaned = cleaned.slice(s, e + 1);
    return JSON.parse(cleaned);
  } catch { return null; }
}

async function polishText(text, project) {
  const sys = `You are a prose polisher for ${project.genre} manuscripts. Tighten prose, eliminate slop, strengthen verbs. Return ONLY polished text.${ANTI_CONTAMINATION}`;
  const prompt = `Polish this chapter. Preserve voice and all details. Return ONLY the polished chapter.\n\nCHAPTER:\n${text}`;
  try {
    const polished = await callOllama('prose-polisher', prompt, sys, 0.3, 8000);
    return polished.length < text.length * 0.5 ? text : polished;
  } catch { return text; }
}

// ═══════════════════════════════════════════════════════════════
// MAIN — Re-run failed outputs
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  RE-RUN: Contamination-failed outputs with anti-contam ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Load existing cache
  const cachePath = resolve(OUT, 'calibration-results.json');
  const cache = JSON.parse(readFileSync(cachePath, 'utf-8'));

  // ── Re-run Project E ──
  console.log('═══ RE-RUN: Project E — Professional Guide ═══\n');
  const projE = makeProject({
    label: 'Professional Guide', book_type: 'nonfiction', content_lane: 'nonfiction',
    genre: 'Self-Help', subgenre: 'Caregiver Wellness',
    seed_concept: 'A field guide for exhausted caregivers and support professionals on building sustainable, person-centered care without burning out.',
    title: 'The Caregiver\'s Compass', author_voice: 'Custom / None',
    nf_structure_mode: 'prescriptive', pov_mode: 'nf-direct', tense: 'present',
    language_intensity: 0, spice_level: 0, chapter_target: 14, chapter_length_target: 4000,
    reading_level: 'adult', target_audience: 'caregivers, social workers, and support professionals',
  });

  const promptE = buildChapterOnePrompt(projE);
  console.log('  🤖 Generating with anti-contamination...');
  let rawE = await callOllama('ghostwriter', promptE, '', 0.72, 6000);
  console.log(`  ⏱️  ${rawE.split(/\s+/).length} words`);

  console.log('  ✨ Polishing...');
  const polishedE = await polishText(rawE, projE);
  const progE = quickScore(polishedE, projE);
  const llmE = await llmScore(polishedE, projE, true);

  const safetyE = runManuscriptSafetyGate(polishedE, { project: projE, stage: 'post-draft' });
  const exportE = runPreExportSafetyGate([{ content_md: polishedE, chapter_number: 1, title: 'The Caregiver\'s Compass' }], { project: projE, stage: 'pre-export' });
  console.log(`  📈 Prog: ${progE.composite} | LLM: ${llmE?.composite || 'N/A'} | Safety: ${safetyE.ok ? '✅' : '❌'} | Export: ${!exportE.blocked ? '✅' : '❌'}`);

  // Update cache
  cache.E = {
    ...cache.E,
    rawText: rawE,
    polishedText: polishedE,
    polishProgScore: progE,
    polishLLMScore: llmE,
    safety: { manuscriptOk: safetyE.ok, exportBlocked: exportE.blocked, processLeaks: safetyE.processLeaks?.hasLeak || false, contamination: safetyE.contamination?.hasContamination || false },
  };

  // ── Re-run Bakeoff 4 & 6 ──
  const BAKEOFF_PREMISE = 'A missing child\'s voice begins broadcasting from every smart speaker in a city, but the child has been dead for twelve years.';
  const rerunBakeoffs = [
    { idx: 3, label: 'Literary + Minimalist + Quiet Dread', genre: 'Literary Fiction', subgenre: 'Psychological', author_voice: 'Literary Atmospheric', beat_style: 'Character Study', story_arc: 'literary_character', pov_mode: 'first', tense: 'present' },
    { idx: 5, label: 'Romantic Suspense + Cinematic + Emotional', genre: 'Romance', subgenre: 'Romantic Suspense', author_voice: 'Clean Commercial Romance', beat_style: 'Slow Burn Romance', story_arc: 'romance_arc', pov_mode: 'third-close', tense: 'past' },
  ];

  for (const entry of rerunBakeoffs) {
    console.log(`\n── RE-RUN: Bakeoff ${entry.idx + 1}: ${entry.label} ──\n`);
    const proj = makeProject({
      ...entry, book_type: 'fiction', content_lane: 'fiction', seed_concept: BAKEOFF_PREMISE,
      title: 'Voice from the Speakers', chapter_target: 20, chapter_length_target: 3500,
      reading_level: 'adult', spice_level: 0, language_intensity: 2,
    });
    const prompt = buildChapterOnePrompt(proj);
    console.log('  🤖 Generating with anti-contamination...');
    const text = await callOllama('ghostwriter', prompt, '', 0.72, 5000);
    console.log(`  ⏱️  ${text.split(/\s+/).length} words`);
    const prog = quickScore(text, proj);
    const llm = await llmScore(text, proj);
    const safety = runManuscriptSafetyGate(text, { project: proj, stage: 'post-draft' });
    const exp = runPreExportSafetyGate([{ content_md: text, chapter_number: 1, title: 'Voice from the Speakers' }], { project: proj, stage: 'pre-export' });
    console.log(`  📈 Prog: ${prog.composite} | LLM: ${llm?.composite || 'N/A'} | Safety: ${safety.ok ? '✅' : '❌'} | Export: ${!exp.blocked ? '✅' : '❌'}`);

    // Update cache
    cache._bakeoff[entry.idx] = {
      ...cache._bakeoff[entry.idx],
      text,
      progScore: prog,
      llmScore: llm,
      safetyOk: safety.ok && !exp.blocked,
    };
  }

  // Write updated cache
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  console.log('\n✅ Updated calibration-results.json');

  // Check final status
  const allSafe = ['A', 'B', 'C', 'D', 'E'].every(k => cache[k]?.safety?.manuscriptOk && !cache[k]?.safety?.exportBlocked)
    && cache._bakeoff.every(b => b.safetyOk);

  console.log(`\n══════════════════════════════════════════════════════`);
  console.log(`  SAFETY: ${allSafe ? '✅ ALL PASS' : '❌ STILL FAILING'}`);
  console.log(`══════════════════════════════════════════════════════\n`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
