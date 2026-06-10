/**
 * Chapter Repair — fills in missing chapters when LLM truncates output.
 * Used by both handleGenerateFoundation and the parallel bible generator.
 */

import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { chapterPlanSchema, unwrapIntegrationResult } from '@/lib/autonovel';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';

export async function repairTruncatedChapters({
  plannedChapters,
  targetCount,
  project,
  outlineMd = '',
  onProgress,
}) {
  if (!plannedChapters.length || plannedChapters.length >= targetCount) {
    return plannedChapters;
  }

  console.warn('[CHAPTER-REPAIR] Only', plannedChapters.length, '/', targetCount, '. Generating remaining…');
  onProgress?.(`Filling missing chapters (${plannedChapters.length}/${targetCount})…`);

  const missingFrom = plannedChapters.length + 1;
  const existSummary = plannedChapters
    .map(ch => `Ch ${ch.chapter_number}: "${ch.title}" — ${ch.beat_summary}`)
    .join('\n');

  const repairResp = await invokeLLMWithRetry({
    prompt: `The outline was TRUNCATED at ${plannedChapters.length} chapters. Generate chapters ${missingFrom} through ${targetCount}.

Project: ${project.title} | Genre: ${project.genre}
Seed: ${project.seed_concept}

Existing chapters (do NOT repeat):
${existSummary}

Outline context:
${(outlineMd || '').slice(0, 3000)}

Return EXACTLY ${targetCount - plannedChapters.length} chapters numbered ${missingFrom}-${targetCount} with {chapter_number, title, beat_summary}. Continue the arc naturally. JSON only.`,
    response_json_schema: chapterPlanSchema,
    model: pickModel('chapter_plan', project),
    spec: project,
    fallback_model: pickFallbackModel('chapter_plan'),
    max_tokens: 16384,
  });

  const repairChapters = Array.isArray(unwrapIntegrationResult(repairResp)?.chapters)
    ? unwrapIntegrationResult(repairResp).chapters
    : [];

  if (repairChapters.length > 0) {
    const result = [...plannedChapters, ...repairChapters];
    console.log('[CHAPTER-REPAIR] After repair:', result.length, 'chapters');
    return result;
  }

  return plannedChapters;
}