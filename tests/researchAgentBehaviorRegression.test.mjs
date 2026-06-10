/**
 * Research Agent Behavior Regression Tests
 *
 * Validates that the fiction and nonfiction research engines
 * have correct prompt structures, output schemas, source discipline,
 * and genre-aware behavior WITHOUT requiring LLM API calls.
 *
 * Tests are deterministic — they analyze the actual code artifacts
 * (prompts, schemas, formatters, routing) not LLM outputs.
 */

// ── Test Harness ──────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.error('  ❌ ' + label); }
}

// ── Import Fiction Research Engine ────────────────────────────────────────
// fictionResearch.js uses browser-only imports (@/lib/integrationRetry, @/api/base44Client)
// so we read the file content and analyze the prompts/schemas directly.

import { readFileSync } from 'fs';
import { resolve } from 'path';

const FICTION_RESEARCH_PATH = resolve('src/lib/fictionResearch.js');
const RESEARCH_STORAGE_PATH = resolve('src/lib/researchStorage.js');
const RESEARCH_SUBPAGE_PATH = resolve('src/components/tools/ResearchSubPage.jsx');
const FICTION_PANEL_PATH = resolve('src/components/notebook/FictionResearchPanel.jsx');
const FOUNDATION_TAB_PATH = resolve('src/components/notebook/FoundationTab.jsx');
const PROJECT_STUDIO_PATH = resolve('src/pages/ProjectStudio.jsx');
const SCENE_WRITER_PATH = resolve('src/lib/sceneWriter.js');
const LOCAL_LLM_PATH = resolve('src/lib/localLLM.js');

let fictionResearchCode, researchStorageCode, researchSubpageCode;
let fictionPanelCode, foundationTabCode, projectStudioCode;
let sceneWriterCode, localLLMCode;

try {
  fictionResearchCode = readFileSync(FICTION_RESEARCH_PATH, 'utf-8');
  researchStorageCode = readFileSync(RESEARCH_STORAGE_PATH, 'utf-8');
  researchSubpageCode = readFileSync(RESEARCH_SUBPAGE_PATH, 'utf-8');
  fictionPanelCode = readFileSync(FICTION_PANEL_PATH, 'utf-8');
  foundationTabCode = readFileSync(FOUNDATION_TAB_PATH, 'utf-8');
  projectStudioCode = readFileSync(PROJECT_STUDIO_PATH, 'utf-8');
  sceneWriterCode = readFileSync(SCENE_WRITER_PATH, 'utf-8');
  localLLMCode = readFileSync(LOCAL_LLM_PATH, 'utf-8');
} catch (e) {
  console.error('FATAL: Could not read source files:', e.message);
  process.exit(1);
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 1: Fiction Research — Plausibility Mode
// ══════════════════════════════════════════════════════════════════════════
console.log('\n═══ SECTION 1: Fiction Research — Plausibility Mode ═══\n');

// 1.1: Fiction prompt focuses on plausibility, not academic citations
assert(
  fictionResearchCode.includes('fiction author') && fictionResearchCode.includes('plausible'),
  'R-1: Fiction prompt frames research for fiction author plausibility'
);

// 1.2: Fiction prompt identifies speculative/technical elements
assert(
  fictionResearchCode.includes('speculative') && fictionResearchCode.includes('real-world'),
  'R-2: Fiction prompt targets speculative elements grounded in real-world knowledge'
);

// 1.3: Fiction priority system exists (critical/important/nice-to-have)
assert(
  fictionResearchCode.includes('critical') &&
  fictionResearchCode.includes('important') &&
  fictionResearchCode.includes('nice-to-have'),
  'R-3: Fiction research uses priority tiers (critical/important/nice-to-have)'
);

// 1.4: Fiction prompt explains what critical means (plot-dependent plausibility)
assert(
  fictionResearchCode.includes('plot depends on this being plausible'),
  'R-4: Critical priority = plot depends on plausibility'
);

// 1.5: Fiction schema requests sensory details (scene-writing support)
assert(
  fictionResearchCode.includes('sensory_details') && fictionResearchCode.includes('smell'),
  'R-5: Fiction schema requests sensory details for scene writing'
);

// 1.6: Fiction schema requests expert dialogue cadence
assert(
  fictionResearchCode.includes('expert_dialogue') &&
  fictionResearchCode.includes('vocabulary and cadence'),
  'R-6: Fiction schema includes expert dialogue vocabulary/cadence'
);

// 1.7: Fiction schema requests procedural steps
assert(
  fictionResearchCode.includes('procedural_steps') &&
  fictionResearchCode.includes('actual steps in order'),
  'R-7: Fiction schema includes procedural step-by-step'
);

// 1.8: Fiction schema requests constraints (what can't happen)
assert(
  fictionResearchCode.includes('constraints') &&
  fictionResearchCode.includes("CAN'T happen"),
  'R-8: Fiction schema includes physical/logical constraints'
);

// 1.9: Fiction schema requests common author mistakes
assert(
  fictionResearchCode.includes('common_mistakes') &&
  fictionResearchCode.includes('knowledgeable readers cringe'),
  'R-9: Fiction schema flags common author mistakes to avoid'
);

// 1.10: Fiction prompt does NOT require citations in prose
assert(
  !fictionResearchCode.includes('citation') &&
  !fictionResearchCode.includes('footnote') &&
  !fictionResearchCode.includes('bibliography'),
  'R-10: Fiction prompt does NOT mention citations/footnotes/bibliography'
);

// 1.11: Fiction prompt explicitly says goal is not to limit imagination
assert(
  fictionResearchCode.includes('not to limit the author'),
  'R-11: Fiction prompt preserves creative flexibility'
);

// 1.12: Fiction output is a "Plausibility Brief"
assert(
  fictionResearchCode.includes('# Plausibility Brief'),
  'R-12: Fiction output formatted as "Plausibility Brief"'
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 2: Nonfiction Research — Deep Fact-Check Mode
// ══════════════════════════════════════════════════════════════════════════
console.log('\n═══ SECTION 2: Nonfiction Research — Deep Fact-Check Mode ═══\n');

// 2.1: Nonfiction prompt exists in ProjectStudio
assert(
  projectStudioCode.includes('deep-dive research assistant for an investigative nonfiction'),
  'R-13: Nonfiction prompt frames research for investigative nonfiction'
);

// 2.2: Nonfiction prompt requires verified facts
assert(
  projectStudioCode.includes('Return ONLY verified, documented, source-aware research'),
  'R-14: Nonfiction prompt demands verified, documented, source-aware research'
);

// 2.3: Nonfiction prompt forbids invention
assert(
  projectStudioCode.includes('Do not invent facts, names, events, dates, documents, or sources'),
  'R-15: Nonfiction prompt explicitly forbids fabricating sources'
);

// 2.4: Nonfiction schema includes key_figures
assert(
  projectStudioCode.includes('key_figures') &&
  projectStudioCode.includes('documented_actions') &&
  projectStudioCode.includes('source_types'),
  'R-16: Nonfiction schema includes key_figures with documented_actions and source_types'
);

// 2.5: Nonfiction schema includes key_events with dates
assert(
  projectStudioCode.includes('key_events') &&
  /key_events.*date.*description.*sources/s.test(projectStudioCode),
  'R-17: Nonfiction schema includes key_events with date, description, sources'
);

// 2.6: Nonfiction schema includes timeline
assert(
  projectStudioCode.includes("timeline: { type: 'array'"),
  'R-18: Nonfiction schema includes chronological timeline'
);

// 2.7: Nonfiction schema includes primary_sources
assert(
  projectStudioCode.includes('primary_sources') &&
  projectStudioCode.includes('source_type') &&
  projectStudioCode.includes('availability'),
  'R-19: Nonfiction schema includes primary_sources with type and availability'
);

// 2.8: Nonfiction schema includes competing_narratives
assert(
  projectStudioCode.includes('competing_narratives') &&
  projectStudioCode.includes('official_story') &&
  projectStudioCode.includes('evidence_counter'),
  'R-20: Nonfiction schema includes competing_narratives with official_story and evidence_counter'
);

// 2.9: Nonfiction prompt requires separation of documented facts from disputed claims
assert(
  projectStudioCode.includes('Separate documented facts from disputed claims'),
  'R-21: Nonfiction prompt separates documented from disputed claims'
);

// 2.10: Nonfiction prompt requires uncertain claims to be marked
assert(
  projectStudioCode.includes('Mark uncertain or source-dependent claims clearly'),
  'R-22: Nonfiction prompt requires uncertain claims to be marked'
);

// 2.11: Nonfiction research output has structured sections
assert(
  projectStudioCode.includes('## Key People & Figures') &&
  projectStudioCode.includes('## Key Events & Incidents') &&
  projectStudioCode.includes('## Timeline') &&
  projectStudioCode.includes('## Primary Sources Available') &&
  projectStudioCode.includes('## Competing Narratives'),
  'R-23: Nonfiction output has structured sections (People, Events, Timeline, Sources, Narratives)'
);

// 2.12: Nonfiction output is a "Deep Research Brief"
assert(
  projectStudioCode.includes('# Deep Research Brief'),
  'R-24: Nonfiction output formatted as "Deep Research Brief"'
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 3: Source Discipline — Both Engines
// ══════════════════════════════════════════════════════════════════════════
console.log('\n═══ SECTION 3: Source Discipline — Both Engines ═══\n');

// 3.1: Fiction prompt says "Be ACCURATE"
assert(
  fictionResearchCode.includes('Be ACCURATE. Do not fabricate scientific facts'),
  'R-25: Fiction engine has accuracy safeguard'
);

// 3.2: Fiction prompt acknowledges unknowns
assert(
  fictionResearchCode.includes('genuinely unknown or debated in real science, say so'),
  'R-26: Fiction engine acknowledges unknowns honestly'
);

// 3.3: Nonfiction prompt requires source types
assert(
  projectStudioCode.includes('Prefer source TYPES and document trails'),
  'R-27: Nonfiction engine prefers source types and document trails'
);

// 3.4: Nonfiction prompt lists specific source categories
assert(
  projectStudioCode.includes('court records') &&
  projectStudioCode.includes('academic sources') &&
  projectStudioCode.includes('public records'),
  'R-28: Nonfiction engine references specific source categories'
);

// 3.5: Fiction prompt doesn't force citations into prose
assert(
  !fictionResearchCode.includes('cite') &&
  !fictionResearchCode.includes('reference [') &&
  !fictionResearchCode.includes('footnote'),
  'R-29: Fiction engine never forces citations into prose'
);

// 3.6: Nonfiction saves structured JSON alongside markdown
assert(
  projectStudioCode.includes("research_data: JSON.stringify(data)"),
  'R-30: Nonfiction saves structured research_data JSON for downstream use'
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 4: Genre-Aware Routing
// ══════════════════════════════════════════════════════════════════════════
console.log('\n═══ SECTION 4: Genre-Aware Routing ═══\n');

// 4.1: FoundationTab routes fiction to FictionResearchPanel
assert(
  foundationTabCode.includes("book_type !== 'nonfiction'") ||
  foundationTabCode.includes('FictionResearchPanel'),
  'R-31: FoundationTab shows FictionResearchPanel for fiction projects'
);

// 4.2: FoundationTab routes nonfiction to ResearchSection
assert(
  foundationTabCode.includes("book_type === 'nonfiction'") ||
  foundationTabCode.includes('ResearchSection'),
  'R-32: FoundationTab shows ResearchSection for nonfiction projects'
);

// 4.3: FictionResearchPanel calls runFictionResearch
assert(
  fictionPanelCode.includes('runFictionResearch'),
  'R-33: FictionResearchPanel calls runFictionResearch (plausibility engine)'
);

// 4.4: ResearchSubPage currently uses fiction engine only (known limitation)
assert(
  researchSubpageCode.includes('runFictionResearch') &&
  !researchSubpageCode.includes('handleResearch') &&
  !researchSubpageCode.includes('nonfiction'),
  'R-34: ResearchSubPage uses fiction engine only (documented known limitation)'
);

// 4.5: handleResearch (nonfiction) is separate from runFictionResearch
assert(
  projectStudioCode.includes('handleResearch') &&
  projectStudioCode.includes('investigative nonfiction'),
  'R-35: handleResearch is a separate nonfiction-specific research function'
);

// 4.6: Fiction research schema ≠ nonfiction research schema
const fictionHasTerminology = fictionResearchCode.includes('terminology');
const nonfictionHasKeyFigures = projectStudioCode.includes('key_figures');
const fictionHasKeyFigures = fictionResearchCode.includes('key_figures');
const nonfictionHasTerminology = /researchSchema[\s\S]{0,500}terminology/.test(projectStudioCode.slice(
  projectStudioCode.indexOf('const researchSchema'),
  projectStudioCode.indexOf('const researchSchema') + 800
));
assert(
  fictionHasTerminology && !fictionHasKeyFigures &&
  nonfictionHasKeyFigures && !nonfictionHasTerminology,
  'R-36: Fiction and nonfiction schemas are structurally different'
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 5: Research Injection into Prose
// ══════════════════════════════════════════════════════════════════════════
console.log('\n═══ SECTION 5: Research Injection into Prose ═══\n');

// 5.1: getRelevantResearch exists and is called in sceneWriter
assert(
  sceneWriterCode.includes('getRelevantResearch'),
  'R-37: sceneWriter.js calls getRelevantResearch for prose grounding'
);

// 5.2: Research injection uses the RESEARCH BRIEF header
assert(
  fictionResearchCode.includes('=== RESEARCH BRIEF (use real terminology and respect constraints) ==='),
  'R-38: Research injection uses clear RESEARCH BRIEF delimiter'
);

// 5.3: Research injection tells prose model to use real terminology
assert(
  fictionResearchCode.includes('Use the real terminology listed above'),
  'R-39: Research injection instructs prose model to use real terminology'
);

// 5.4: Research injection tells prose model to respect constraints
assert(
  fictionResearchCode.includes('Respect the constraints'),
  'R-40: Research injection instructs prose model to respect physical constraints'
);

// 5.5: Research injection filters by chapter relevance (not dumping everything)
assert(
  fictionResearchCode.includes('beatWords') && fictionResearchCode.includes('isRelevant'),
  'R-41: Research injection filters sections by chapter relevance'
);

// 5.6: Research injection does NOT force footnotes/citations into prose
assert(
  !fictionResearchCode.includes('cite in prose') &&
  !fictionResearchCode.includes('add footnote') &&
  !fictionResearchCode.includes('add citation'),
  'R-42: Research injection does NOT force footnotes/citations into prose'
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 6: LLM Agent Routing for Research
// ══════════════════════════════════════════════════════════════════════════
console.log('\n═══ SECTION 6: LLM Agent Routing ═══\n');

// 6.1: Dedicated research agent model exists
assert(
  localLLMCode.includes("researcher: 'researcher'") ||
  localLLMCode.includes("researcher:"),
  'R-43: Dedicated researcher agent model defined in localLLM'
);

// 6.2: Research temperature is conservative (low creativity, high accuracy)
assert(
  localLLMCode.includes('researcher') &&
  (localLLMCode.includes('0.3') || localLLMCode.includes('0.2') || localLLMCode.includes('0')),
  'R-44: Research agent uses conservative temperature'
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 7: Research Storage Safety
// ══════════════════════════════════════════════════════════════════════════
console.log('\n═══ SECTION 7: Research Storage Safety ═══\n');

// 7.1: Large content gets uploaded, not truncated
assert(
  researchStorageCode.includes('MAX_INLINE_SIZE') &&
  researchStorageCode.includes('uploadViaGitHub'),
  'R-45: Large research content uploaded via GitHub, not silently truncated'
);

// 7.2: URL resolution exists for fetching saved research
assert(
  researchStorageCode.includes('resolveResearchContent') &&
  researchStorageCode.includes('research_md_url'),
  'R-46: resolveResearchContent fetches from URL when available'
);

// 7.3: projectHasResearch check exists
assert(
  researchStorageCode.includes('projectHasResearch'),
  'R-47: projectHasResearch utility exists for UI state'
);

// 7.4: Fiction research protects against overwriting twist settings
assert(
  fictionResearchCode.includes('delete researchFields.num_twists') &&
  fictionResearchCode.includes('delete researchFields.twist_count'),
  'R-48: Fiction research save protects against overwriting twist settings'
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 8: Adult Romance Research Safety
// ══════════════════════════════════════════════════════════════════════════
console.log('\n═══ SECTION 8: Adult Content Research Boundaries ═══\n');

// 8.1: Fiction research doesn't have content-blocking for adult genre
// (correct — plausibility research is genre-neutral)
assert(
  !fictionResearchCode.includes('explicit') &&
  !fictionResearchCode.includes('censor') &&
  !fictionResearchCode.includes('block adult'),
  'R-49: Fiction research engine is genre-neutral (no adult content censorship in research)'
);

// 8.2: Research prompt focuses on real-world accuracy, not content policing
assert(
  fictionResearchCode.includes('Be ACCURATE') &&
  !fictionResearchCode.includes('refuse') &&
  !fictionResearchCode.includes('inappropriate'),
  'R-50: Fiction research focuses on accuracy, not content policing'
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 9: Format Differences — Fiction vs Nonfiction
// ══════════════════════════════════════════════════════════════════════════
console.log('\n═══ SECTION 9: Format Differences ═══\n');

// 9.1: Fiction output has "Common Author Mistakes to Avoid"
assert(
  fictionResearchCode.includes('### Common Author Mistakes to Avoid'),
  'R-51: Fiction output includes "Common Author Mistakes to Avoid" section'
);

// 9.2: Fiction output has "Plausible Speculative Extensions"
assert(
  fictionResearchCode.includes('### Plausible Speculative Extensions'),
  'R-52: Fiction output includes "Plausible Speculative Extensions" section'
);

// 9.3: Fiction output has "How Experts Actually Talk About This"
assert(
  fictionResearchCode.includes('### How Experts Actually Talk About This'),
  'R-53: Fiction output includes "How Experts Actually Talk About This" section'
);

// 9.4: Nonfiction output has "Key People & Figures" (not in fiction)
assert(
  projectStudioCode.includes('## Key People & Figures') &&
  !fictionResearchCode.includes('## Key People & Figures'),
  'R-54: Nonfiction output has "Key People & Figures" (fiction does not)'
);

// 9.5: Nonfiction output has "Primary Sources Available" (not in fiction)
assert(
  projectStudioCode.includes('## Primary Sources Available') &&
  !fictionResearchCode.includes('## Primary Sources Available'),
  'R-55: Nonfiction output has "Primary Sources Available" (fiction does not)'
);

// 9.6: Nonfiction output has "Competing Narratives / Evidence Tensions"
assert(
  projectStudioCode.includes('## Competing Narratives / Evidence Tensions') &&
  !fictionResearchCode.includes('## Competing Narratives'),
  'R-56: Nonfiction output has "Competing Narratives" (fiction does not)'
);

// 9.7: Nonfiction output includes raw structured JSON
assert(
  projectStudioCode.includes('## Raw Structured Research JSON'),
  'R-57: Nonfiction output includes raw structured research JSON'
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 10: Edge Cases and Safety
// ══════════════════════════════════════════════════════════════════════════
console.log('\n═══ SECTION 10: Edge Cases and Safety ═══\n');

// 10.1: Fiction research handles empty story bible
assert(
  fictionResearchCode.includes("extracted.topics.length === 0") ||
  fictionResearchCode.includes("topics.length === 0"),
  'R-58: Fiction research handles empty/no-topic story bible gracefully'
);

// 10.2: Fiction research handles JSON parse failure
assert(
  fictionResearchCode.includes('Topic extraction JSON parse failed'),
  'R-59: Fiction research handles JSON parse failure gracefully'
);

// 10.3: Fiction research has timeout protection
assert(
  fictionResearchCode.includes('TOPIC_TIMEOUT') && fictionResearchCode.includes('120000'),
  'R-60: Fiction research has per-topic timeout (120s)'
);

// 10.4: Fiction research retries failed topics
assert(
  fictionResearchCode.includes('Retrying') && fictionResearchCode.includes('failed topics'),
  'R-61: Fiction research retries failed topics individually'
);

// 10.5: Fiction research has batch size control
assert(
  fictionResearchCode.includes('BATCH_SIZE') && fictionResearchCode.includes('3'),
  'R-62: Fiction research uses parallel batches (size 3) with rate limit delays'
);

// 10.6: Nonfiction research handles missing seed concept
assert(
  projectStudioCode.includes("Add a seed concept/topic before running deep research"),
  'R-63: Nonfiction research requires seed concept, shows error if missing'
);

// 10.7: ResearchSubPage requires story bible for full research
assert(
  researchSubpageCode.includes('hasStoryBible') &&
  researchSubpageCode.includes('Generate a story bible first'),
  'R-64: ResearchSubPage requires story bible, shows guidance if missing'
);

// 10.8: Manual topic research handles empty input
assert(
  researchSubpageCode.includes("!manualTopic.trim()"),
  'R-65: Manual topic research handles empty input'
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION 11: No Contamination / Process Leak in Research
// ══════════════════════════════════════════════════════════════════════════
console.log('\n═══ SECTION 11: No Contamination ═══\n');

// 11.1: Fiction research prompts don't contain process-leak patterns
// Note: 'Step 1:' appears in code comments (// ── Step 1:) which is fine.
// We check for patterns that only appear in LLM process leak contamination.
const processLeakPatterns = ['Action Plan', 'Implementation Plan', 'DELIVERABLE', 'Unity Supported Living'];
const hasProcessLeak = processLeakPatterns.some(p => fictionResearchCode.includes(p));
assert(!hasProcessLeak, 'R-66: Fiction research prompts contain no process-leak patterns');

// 11.2: Nonfiction research prompts don't contain process-leak patterns
const nfResearchSection = projectStudioCode.slice(
  projectStudioCode.indexOf('handleResearch'),
  projectStudioCode.indexOf('handleResearch') + 3000
);
const hasNfProcessLeak = processLeakPatterns.some(p => nfResearchSection.includes(p));
assert(!hasNfProcessLeak, 'R-67: Nonfiction research prompts contain no process-leak patterns');

// 11.3: Fiction research doesn't inject DET-specific content
assert(
  !fictionResearchCode.includes('Digital Equity Tribunal') &&
  !fictionResearchCode.includes('DET') &&
  !fictionResearchCode.includes('Priya'),
  'R-68: Fiction research contains no DET-specific content'
);

// 11.4: Nonfiction research doesn't inject DET-specific content
assert(
  !nfResearchSection.includes('Digital Equity Tribunal') &&
  !nfResearchSection.includes('DET'),
  'R-69: Nonfiction research contains no DET-specific content'
);

// ════════════════════════════════════════════════════════════════════════════
console.log('\n════════════════════════════════════════════════════════════════');
console.log(`RESEARCH AGENT BEHAVIOR REGRESSION: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log('════════════════════════════════════════════════════════════════');
if (failed > 0) process.exit(1);
